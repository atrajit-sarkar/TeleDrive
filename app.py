import os
import base64
import io
import logging
import time
import re # For parsing tags
import math # For file size formatting
from flask import Flask, request, jsonify, session, Response, stream_with_context
from flask_cors import CORS
from pyrogram import Client, enums
from pyrogram.errors import (
    SessionPasswordNeeded,
    PhoneCodeInvalid,
    PhoneCodeExpired,
    FloodWait,
    ApiIdInvalid,
    AuthKeyUnregistered, # Important for session validation
)
from pyrogram.types import Message # For type hinting
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)

# --- Flask App Setup ---
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'a-very-strong-and-random-secret-key-change-me')

# --- CORS Configuration ---
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# --- Pyrogram Client Setup ---
api_id_str = os.getenv('TELEGRAM_API_ID')
api_hash = os.getenv('TELEGRAM_API_HASH')
api_id = None

if not api_id_str or not api_hash:
    logging.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in the .env file.")
else:
    try:
        api_id = int(api_id_str)
    except ValueError:
        logging.error("TELEGRAM_API_ID must be an integer.")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Progress callback adapted for logging
def logging_progress(current, total, *args):
    percentage = (current / total) * 100 if total > 0 else 0
    log_now = False
    if not hasattr(logging_progress, 'last_logged_percentage_map'):
        logging_progress.last_logged_percentage_map = {} # Use a map if multiple transfers occur

    # Using args to get a unique identifier if available, else default to generic
    transfer_id = args[0] if args else "default_transfer"

    last_logged = logging_progress.last_logged_percentage_map.get(transfer_id, -10) # Start below 0

    if percentage >= last_logged + 10 or current == total or current == 0 : # Log at start, end, or every 10%
        log_now = True

    if log_now:
        logging.info(f"Transfer '{transfer_id}': {current}/{total} bytes ({percentage:.2f}%)")
        logging_progress.last_logged_percentage_map[transfer_id] = percentage
    
    if current == total: # Reset for this specific transfer
        if transfer_id in logging_progress.last_logged_percentage_map:
            del logging_progress.last_logged_percentage_map[transfer_id]


def get_user_client():
    """
    Creates a Pyrogram client instance using the session string from the Flask session.
    This function does NOT connect the client.
    """
    session_string = session.get('telegram_session_string')
    if not api_id or not api_hash: # api_id is now int or None
        logging.error("Cannot create Pyrogram Client: API ID or API Hash is missing or invalid.")
        return None
    client = Client(name="user_session_in_memory", api_id=api_id, api_hash=api_hash, session_string=session_string, in_memory=True)
    return client

def generate_chunks(buffer, chunk_size=1024*1024): # 1MB chunks for streaming
    """Helper function to generate chunks from a file-like object for streaming."""
    while True:
        chunk = buffer.read(chunk_size)
        if not chunk:
            break
        yield chunk

# --- Helper Functions for MediaItem Structure ---
def get_backend_base_url():
    """Gets the base URL of the backend, e.g., http://localhost:5000"""
    # For development, request.host_url is usually fine.
    # In production, especially behind a reverse proxy, you might want to use
    # an environment variable for the public-facing URL.
    # Example: return os.getenv('BACKEND_PUBLIC_URL', request.host_url.rstrip('/'))
    return request.host_url.rstrip('/')

def to_frontend_file_type(pyrogram_media_type: enums.MessageMediaType = None, mime_type_str: str = None) -> str:
    """Maps Pyrogram media types and MIME types to frontend-specific categories."""
    if pyrogram_media_type:
        if pyrogram_media_type == enums.MessageMediaType.PHOTO: return "image"
        if pyrogram_media_type in [enums.MessageMediaType.VIDEO, enums.MessageMediaType.VIDEO_NOTE]: return "video"
        if pyrogram_media_type in [enums.MessageMediaType.AUDIO, enums.MessageMediaType.VOICE]: return "audio"
        if pyrogram_media_type == enums.MessageMediaType.ANIMATION: return "image" # Treat GIFs as images
        if pyrogram_media_type == enums.MessageMediaType.STICKER: return "image"
        # For MessageMediaType.DOCUMENT, we rely more on the mime_type_str below
    
    if mime_type_str:
        mime_type_lower = mime_type_str.lower()
        if mime_type_lower.startswith('image/'): return "image"
        if mime_type_lower.startswith('video/'): return "video"
        if mime_type_lower.startswith('audio/'): return "audio"
        if mime_type_lower in ['application/pdf', 'application/msword', 
                               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                               'application/vnd.ms-excel', 
                               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                               'application/vnd.ms-powerpoint',
                               'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                               'text/plain', 'text/csv', 'application/rtf']: return "document"
        if mime_type_lower in ['application/zip', 'application/x-rar-compressed', 'application/x-tar', 
                               'application/x-7z-compressed', 'application/gzip', 'application/x-bzip2']: return "archive"
    
    # If it was a document and didn't fit a more specific category by MIME type
    if pyrogram_media_type == enums.MessageMediaType.DOCUMENT:
        return "document"
        
    return "other"

def parse_tags_from_caption(caption_text: str = None) -> list[str]:
    """Extracts #hashtags from caption text."""
    if not caption_text:
        return []
    return re.findall(r"#(\w+)", caption_text)

def format_file_size(size_bytes: int) -> str:
    """Formats file size in bytes to a human-readable string (KB, MB, GB)."""
    if not isinstance(size_bytes, (int, float)) or size_bytes < 0:
        return "N/A"
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = int(math.floor(math.log(abs(size_bytes), 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

async def create_media_item_from_message(message: Message) -> dict:
    """
    Converts a Pyrogram Message object into the frontend MediaItem structure.
    """
    if not message or not message.media:
        return None

    item_id = str(message.id)
    file_name = "Unknown File"
    mime_type = "application/octet-stream" # Default MIME type
    file_size_bytes = 0
    actual_media_payload = None # e.g., message.document, message.video
    pyrogram_media_type_enum = message.media # This is an enum like MessageMediaType.VIDEO

    # Extracting common attributes based on media type
    if message.document:
        actual_media_payload = message.document
        file_name = actual_media_payload.file_name if actual_media_payload.file_name else f"doc_{actual_media_payload.file_unique_id}"
        mime_type = actual_media_payload.mime_type or mime_type
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.video:
        actual_media_payload = message.video
        file_name = actual_media_payload.file_name if actual_media_payload.file_name else f"video_{actual_media_payload.file_unique_id}.mp4"
        mime_type = actual_media_payload.mime_type or "video/mp4"
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.audio:
        actual_media_payload = message.audio
        file_name = actual_media_payload.file_name if actual_media_payload.file_name else f"audio_{actual_media_payload.file_unique_id}.mp3"
        mime_type = actual_media_payload.mime_type or "audio/mpeg"
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.photo:
        actual_media_payload = message.photo # Photo object itself
        file_name = f"photo_{actual_media_payload.file_unique_id}.jpg" # Photos are often sent as JPEGs
        mime_type = "image/jpeg" # Default for photos
        file_size_bytes = actual_media_payload.file_size or 0 # file_size of the largest version
    elif message.voice:
        actual_media_payload = message.voice
        file_name = f"voice_{actual_media_payload.file_unique_id}.ogg" # Voice notes are often .ogg
        mime_type = actual_media_payload.mime_type or "audio/ogg"
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.video_note:
        actual_media_payload = message.video_note
        file_name = f"videonote_{actual_media_payload.file_unique_id}.mp4"
        mime_type = actual_media_payload.mime_type or "video/mp4"
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.animation: # GIFs
        actual_media_payload = message.animation
        file_name = actual_media_payload.file_name if actual_media_payload.file_name else f"animation_{actual_media_payload.file_unique_id}.gif"
        mime_type = actual_media_payload.mime_type or "image/gif" # Often image/gif or video/mp4
        file_size_bytes = actual_media_payload.file_size or 0
    elif message.sticker:
        actual_media_payload = message.sticker
        file_name = f"sticker_{actual_media_payload.file_unique_id}.webp" # Stickers are often .webp
        mime_type = actual_media_payload.mime_type or "image/webp"
        file_size_bytes = actual_media_payload.file_size or 0
    else:
        logging.warning(f"Unknown or unhandled media type for message {item_id}: {message.media}")
        return None # Cannot process this media type

    frontend_type = to_frontend_file_type(pyrogram_media_type_enum, mime_type)
    
    has_thumbnail = False
    if actual_media_payload and hasattr(actual_media_payload, "thumbs") and actual_media_payload.thumbs:
        has_thumbnail = True
    elif pyrogram_media_type_enum == enums.MessageMediaType.PHOTO: # Photos can act as their own thumbnails
        has_thumbnail = True
    
    BACKEND_BASE_URL = get_backend_base_url()
    item_url = f"{BACKEND_BASE_URL}/stream_media/{item_id}"
    thumb_url = f"{BACKEND_BASE_URL}/stream_thumbnail/{item_id}" if has_thumbnail else None
    
    # Ensure timestamp is in milliseconds
    timestamp_ms = int(message.date.timestamp() * 1000) if message.date else int(time.time() * 1000)
    
    parsed_tags = parse_tags_from_caption(message.caption)
    formatted_size = format_file_size(file_size_bytes)

    return {
        'id': item_id,
        'name': file_name,
        'type': frontend_type,
        'url': item_url,
        'thumbnailUrl': thumb_url,
        'timestamp': timestamp_ms,
        'tags': parsed_tags,
        'size': formatted_size,
        'dataAiHint': frontend_type # Default AI hint to the determined type
    }

# --- Authentication Routes ---
@app.route('/send_code_request', methods=['POST'])
async def send_code_request():
    if not api_id or not api_hash:
        return jsonify({'error': 'Server not configured for Telegram API.'}), 500
        
    data = request.get_json()
    phone_number = data.get('phone_number', '').strip()

    if not phone_number or not phone_number.replace('+', '').isdigit():
        return jsonify({'error': 'A valid phone number is required'}), 400
    
    temp_client = Client(name="temp_auth_client", api_id=api_id, api_hash=api_hash, in_memory=True)
    try:
        await temp_client.connect()
        sent_code = await temp_client.send_code(phone_number)
        session['phone_number'] = phone_number
        session['phone_code_hash'] = sent_code.phone_code_hash
        logging.info(f"Code sent to {phone_number}. Session data set for Pyrogram.")
        return jsonify({'message': 'Code request sent successfully'})
    except FloodWait as e:
        logging.warning(f"Flood wait: {e.value}s for {phone_number}")
        return jsonify({'error': f'Too many requests. Try again in {e.value} seconds.'}), 429
    except ApiIdInvalid:
        logging.error("Invalid API ID or API Hash.")
        return jsonify({'error': 'Invalid API credentials on server.'}), 500
    except Exception as e:
        logging.error(f"Error sending code request: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred.'}), 500
    finally:
        if temp_client.is_connected:
            await temp_client.disconnect()

@app.route('/sign_in', methods=['POST'])
async def sign_in():
    if not api_id or not api_hash:
        return jsonify({'error': 'Server not configured for Telegram API.'}), 500

    data = request.get_json()
    code = data.get('code', '').strip()

    if 'phone_number' not in session or 'phone_code_hash' not in session:
        logging.warning("Sign-in attempt failed: 'phone_number' or 'phone_code_hash' not in session.")
        return jsonify({'error': 'Session expired or not found. Please request a new code.'}), 400

    if not code.isdigit():
        return jsonify({'error': 'Verification code must be numeric'}), 400

    phone_number = session['phone_number']
    phone_code_hash = session['phone_code_hash']
    
    client_for_signin = Client(name="signin_client", api_id=api_id, api_hash=api_hash, in_memory=True)
    try:
        await client_for_signin.connect()
        await client_for_signin.sign_in(phone_number, phone_code_hash, code)

        session['telegram_session_string'] = await client_for_signin.export_session_string()
        session['telegram_authenticated'] = True # Mark as authenticated

        session.pop('phone_number', None)
        session.pop('phone_code_hash', None)
        logging.info(f"User {phone_number} signed in successfully. Pyrogram session string stored.")
        return jsonify({'message': 'Signed in successfully'})
    except SessionPasswordNeeded:
        logging.warning(f"Sign-in for {phone_number} requires 2FA password.")
        return jsonify({'error': 'Two-factor authentication is enabled. This app version does not support 2FA password entry.'}), 401
    except (PhoneCodeInvalid, PhoneCodeExpired):
        logging.warning(f"Invalid or expired code for {phone_number}.")
        return jsonify({'error': 'The verification code is invalid or has expired.'}), 400
    except Exception as e:
        logging.error(f"Error during sign-in for {phone_number}: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred during sign-in.'}), 500
    finally:
        if client_for_signin.is_connected:
            await client_for_signin.disconnect()

@app.route('/is_authenticated', methods=['GET'])
async def is_authenticated():
    if not session.get('telegram_session_string'):
        return jsonify({'authenticated': False, 'message': 'No session string found.'})

    client = get_user_client()
    if client is None: # Handles case where api_id/hash might be missing after startup
        return jsonify({'authenticated': False, 'error': 'Server Telegram API not configured.'}), 500
    
    try:
        await client.connect()
        is_auth = client.is_authorized
        session['telegram_authenticated'] = is_auth # Update session flag
        return jsonify({'authenticated': is_auth})
    except AuthKeyUnregistered:
        logging.warning("Auth key unregistered. Clearing session.")
        session.clear()
        return jsonify({'authenticated': False, 'error': 'Session is invalid. Please log in again.'})
    except Exception as e:
        logging.error(f"Error checking authentication status: {e}", exc_info=True)
        session['telegram_authenticated'] = False # Assume not authenticated on error
        return jsonify({'authenticated': False, 'error': 'Could not verify session with Telegram.'}), 500
    finally:
        if client and client.is_connected:
            await client.disconnect()

@app.route('/logout', methods=['POST'])
async def logout():
    client = get_user_client()
    if client:
        try:
            await client.connect()
            if client.is_authorized: # Only attempt logout if authorized
                await client.log_out()
                logging.info("User logged out from Telegram via Pyrogram.")
        except AuthKeyUnregistered:
            logging.info("Auth key was already unregistered during logout. Session was likely invalid.")
        except Exception as e:
            logging.error(f"Error during Pyrogram logout: {e}", exc_info=True)
            # Proceed to clear local session anyway
        finally:
            if client.is_connected:
                await client.disconnect()
    
    session.clear() # Clear local Flask session
    return jsonify({'message': 'Logged out successfully.'})

# --- Main Application Routes (Media Handling) ---
@app.route('/get_saved_messages_media', methods=['GET'])
async def get_saved_messages_media():
    if not session.get('telegram_authenticated'):
        # Try to re-validate if session string exists but flag is false/missing
        if session.get('telegram_session_string'):
            auth_response = await is_authenticated()
            auth_data = auth_response.get_json()
            if not auth_data.get('authenticated'):
                return jsonify({'error': auth_data.get('error', 'User not authenticated or session invalid.')}), 401
        else:
            return jsonify({'error': 'User not authenticated.'}), 401

    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Server Telegram API not configured.'}), 500
            
    media_items_list = []
    try:
        await client.connect()
        # Fetching history from "me" (Saved Messages)
        async for message in client.get_chat_history("me", limit=100): # Adjust limit as needed
            if message.media: # Process only messages with media
                try:
                    media_item = await create_media_item_from_message(message)
                    if media_item:
                        media_items_list.append(media_item)
                except Exception as e_media:
                    logging.error(f"Error processing message {message.id} into media item: {e_media}", exc_info=True)
        
        return jsonify(media_items_list)
    except AuthKeyUnregistered:
        logging.warning("Auth key unregistered while fetching media. Clearing session.")
        session.clear()
        return jsonify({'error': 'Session is invalid. Please log in again.'}), 401
    except Exception as e:
        logging.error(f"Error fetching saved messages media: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred while fetching media.'}), 500
    finally:
        if client and client.is_connected:
            await client.disconnect()

@app.route('/stream_media/<int:message_id>', methods=['GET'])
async def stream_media(message_id):
    if not session.get('telegram_authenticated'):
         return jsonify({'error': 'User not authenticated'}), 401

    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Server Telegram API not configured.'}), 500

    try:
        await client.connect()
        # Fetch the specific message by ID from "me" (Saved Messages)
        message = await client.get_messages("me", message_ids=message_id)
        
        if not message or not message.media:
            return jsonify({'error': 'Media not found or message has no media.'}), 404

        # Determine file size and mime type from the message object for headers
        file_size = 0
        mime_type = 'application/octet-stream' # Default
        suggested_filename = f"media_{message_id}"

        payload = message.document or message.video or message.audio or message.photo or \
                  message.voice or message.video_note or message.animation or message.sticker
        
        if payload:
            if hasattr(payload, 'file_size') and payload.file_size:
                file_size = payload.file_size
            if hasattr(payload, 'mime_type') and payload.mime_type:
                mime_type = payload.mime_type
            if hasattr(payload, 'file_name') and payload.file_name:
                suggested_filename = payload.file_name
            elif message.photo: # Photos might not have file_name attribute directly
                suggested_filename = f"photo_{message.id}.jpg"


        # Use BytesIO as an in-memory buffer for downloading
        media_buffer = io.BytesIO()
        # Pyrogram's download_media can write to a file-like object
        # Pass the message object itself; Pyrogram handles which part to download (e.g. largest photo)
        await client.download_media(message, file_name=media_buffer, progress=logging_progress, progress_args=(f"msg_{message_id}",))
        media_buffer.seek(0) # Rewind buffer to the beginning for reading

        response = Response(stream_with_context(generate_chunks(media_buffer)), mimetype=mime_type)
        if file_size > 0:
            response.headers['Content-Length'] = str(file_size)
        
        # Content-Disposition to suggest filename
        try:
            suggested_filename.encode('ascii') # Check if ASCII-safe
            response.headers['Content-Disposition'] = f'inline; filename="{suggested_filename}"'
        except UnicodeEncodeError: # Handle non-ASCII filenames
            encoded_name = base64.urlsafe_b64encode(suggested_filename.encode('utf-8')).decode('ascii')
            response.headers['Content-Disposition'] = f"inline; filename*=UTF-8''{encoded_name}"
            
        return response
    except AuthKeyUnregistered:
        logging.warning(f"Auth key unregistered while streaming media {message_id}. Clearing session.")
        session.clear()
        return jsonify({'error': 'Session is invalid. Please log in again.'}), 401
    except Exception as e:
        logging.error(f"Error streaming media for message ID {message_id}: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred during streaming.'}), 500
    finally:
        if client and client.is_connected:
            await client.disconnect()

@app.route('/stream_thumbnail/<int:message_id>', methods=['GET'])
async def stream_thumbnail(message_id):
    if not session.get('telegram_authenticated'):
        return jsonify({'error': 'User not authenticated'}), 401
        
    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Server Telegram API not configured.'}), 500
        
    try:
        await client.connect()
        message = await client.get_messages("me", message_ids=message_id)
        
        if not message or not message.media:
            return jsonify({'error': 'Media not found for this message ID.'}), 404

        thumb_to_download_ref = None # This will hold the actual thumbnail object or Photo object

        # Determine the media payload that might contain thumbnails
        media_payload = (message.video or message.document or message.audio or
                         message.animation or message.voice or message.video_note or message.sticker)

        if message.photo: # For photos, check .thumbs or use the photo itself
            if message.photo.thumbs:
                thumb_to_download_ref = message.photo.thumbs[-1] # Largest thumb from list
            else: # No explicit thumbs list, try photo object (Pyrogram might pick smallest size)
                thumb_to_download_ref = message.photo
        elif media_payload and hasattr(media_payload, "thumbs") and media_payload.thumbs:
            thumb_to_download_ref = media_payload.thumbs[-1] # Largest thumb from list
        
        if not thumb_to_download_ref:
            logging.info(f"No suitable thumbnail found for message {message_id}, media type {message.media}")
            return jsonify({'error': 'Thumbnail not available for this media type.'}), 404

        thumb_buffer = io.BytesIO()
        # Download the specific thumbnail reference (which is a Thumbnail or Photo object)
        await client.download_media(thumb_to_download_ref, file_name=thumb_buffer)
        thumb_buffer.seek(0)
            
        return Response(thumb_buffer.getvalue(), mimetype='image/jpeg') # Telegram thumbs are typically JPEG
    except AuthKeyUnregistered:
        logging.warning(f"Auth key unregistered while streaming thumbnail {message_id}. Clearing session.")
        session.clear()
        return jsonify({'error': 'Session is invalid. Please log in again.'}), 401
    except Exception as e:
        logging.error(f"Error streaming thumbnail for message ID {message_id}: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred during thumbnail streaming.'}), 500
    finally:
        if client and client.is_connected:
            await client.disconnect()

# --- File Upload Endpoint ---
@app.route('/upload_file', methods=['POST'])
async def upload_file():
    if not session.get('telegram_authenticated'):
        if session.get('telegram_session_string'):
            auth_response = await is_authenticated()
            auth_data = auth_response.get_json()
            if not auth_data.get('authenticated'):
                return jsonify({'error': auth_data.get('error', 'User not authenticated or session invalid.'), "success": False}), 401
        else:
            return jsonify({'error': 'User not authenticated.', "success": False}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.', "success": False}), 400
    
    file_storage = request.files['file'] # This is a FileStorage object
    if file_storage.filename == '':
        return jsonify({'error': 'No selected file.', "success": False}), 400

    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Server Telegram API not configured.', "success": False}), 500

    try:
        await client.connect()

        file_stream = file_storage.stream # Get the underlying file stream
        original_filename = file_storage.filename
        # User might provide a different filename in form data
        custom_filename = request.form.get('fileName', original_filename).strip()
        if not custom_filename: # Ensure filename is not empty
            custom_filename = original_filename # Fallback to original if provided is empty

        tags_input_str = request.form.get('tags', '') # e.g., "tag1, tag2, #tag3"
        
        # Prepare caption with tags: Start with filename, then add #tags
        caption_elements = [custom_filename]
        if tags_input_str:
            # Split by comma or space, then ensure each tag is #-prefixed and unique
            raw_tags = re.split(r'[\s,]+', tags_input_str)
            processed_tags = set() # Use set for uniqueness
            for tag in raw_tags:
                if not tag: continue
                clean_tag = tag.lstrip('#') # Remove existing # if any
                if clean_tag: # Ensure tag is not empty after stripping
                    processed_tags.add(f"#{clean_tag}")
            if processed_tags:
                caption_elements.extend(sorted(list(processed_tags))) # Add sorted tags

        final_caption = "\n".join(caption_elements)
        if len(final_caption) > 1024: # Telegram caption limit for media
            final_caption = final_caption[:1021] + "..." # Truncate if too long

        # Use send_document as it's versatile. force_document=False lets Telegram try to show as photo/video.
        sent_message = await client.send_document(
            "me", # Send to "Saved Messages"
            document=file_stream,
            caption=final_caption,
            file_name=custom_filename, # This ensures the filename is preserved
            force_document=False, 
            progress=logging_progress,
            progress_args=(f"upload_{custom_filename}",) # Pass filename for progress tracking id
        )
        
        if not sent_message:
            return jsonify({'error': 'Failed to upload file to Telegram.', "success": False}), 500

        # Convert the sent message to the MediaItem structure for the response
        new_media_item = await create_media_item_from_message(sent_message)
        if not new_media_item:
             # This case should ideally not happen if upload was successful and create_media_item_from_message is robust
             logging.error(f"File uploaded (msg_id: {sent_message.id}), but could not process its details for response.")
             return jsonify({'error': 'File uploaded, but could not format its details for the response.', "success": False}), 500
        
        logging.info(f"File '{custom_filename}' uploaded successfully by user to Saved Messages.")
        return jsonify({
            "success": True,
            "message": "File uploaded successfully to Saved Messages.",
            "newItem": new_media_item
        })

    except AuthKeyUnregistered:
        logging.warning("Auth key unregistered during file upload. Clearing session.")
        session.clear()
        return jsonify({'error': 'Session is invalid. Please log in again.', "success": False}), 401
    except FloodWait as e:
        logging.warning(f"Flood wait during file upload: {e.value}s for user.")
        return jsonify({'error': f'Too many requests. Try again in {e.value} seconds.', "success": False}), 429
    except Exception as e:
        logging.error(f"Error uploading file '{file_storage.filename}': {e}", exc_info=True)
        return jsonify({'error': f'An unexpected error occurred during file upload: {str(e)}', "success": False}), 500
    finally:
        if client and client.is_connected:
            await client.disconnect()

if __name__ == '__main__':
    # Determine debug mode from environment variable, default to True for dev
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    # Determine port from environment variable, default to 5000
    port = int(os.getenv('PORT', 5000))
    
    if not api_id or not api_hash:
        print("CRITICAL: TELEGRAM_API_ID or TELEGRAM_API_HASH is not set or invalid. The application may not function correctly.")
        # Optionally, exit here if these are critical for startup
        # sys.exit(1)

    app.run(debug=debug_mode, host='0.0.0.0', port=port)