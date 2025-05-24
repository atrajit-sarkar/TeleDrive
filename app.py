import os
from flask import Flask, request, jsonify, session, Response, stream_with_context
from flask_cors import CORS
from telethon import TelegramClient, errors
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv(override=True) # Use override=True if you need to prioritize .env over existing env vars

# Flask app setup
app = Flask(__name__)
# Replace with a strong secret key for session management
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your_default_secret_key')
CORS(app)  # Enable CORS for all origins

# Telegram client setup
api_id = os.getenv('TELEGRAM_API_ID')
api_hash = os.getenv('TELEGRAM_API_HASH')
# Ensure API credentials are provided
if not api_id or not api_hash:
    logging.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in the .env file.")
    # Depending on your deployment, you might want to exit here or raise an error
    # For development, we'll proceed but expect errors on Telegram interactions

# Remove the global client instance - we will create a client per request
# based on the user's session string.
# client = TelegramClient(session_name, api_id, api_hash)

def get_user_client():
    """
    Retrieves or creates a Telethon client instance using the session string
    stored in the Flask session.
    """
    session_string = session.get('telegram_session_string')
    # If session_string is None, StringSession() creates an empty session.
    # Ensure api_id and api_hash are not None before creating client
    if api_id is None or api_hash is None:
        logging.error("Cannot create TelegramClient: API ID or API Hash is missing.")
        return None # Return None if credentials are not set

    # Pass session_string directly to StringSession constructor
    client = TelegramClient(StringSession(session_string) if session_string else StringSession(), int(api_id), api_hash)
    return client

# Configure logging
logging.basicConfig(level=logging.INFO)

# Helper function to generate chunks from a file-like object for streaming
def generate_chunks(buffer, chunk_size=8192): # 8KB chunks
    while True:
        chunk = buffer.read(chunk_size) # Read from the buffer
        if not chunk:
            break
@app.route('/send_code_request', methods=['POST'])
async def send_code_request():
    """
    Sends a code request to the provided phone number.
    Requires 'phone_number' in the request JSON body.
    """
    data = request.get_json()
    phone_number = data.get('phone_number', '').strip() # Get phone number and remove whitespace

    # Basic input validation
    if not phone_number:
        return jsonify({'error': 'Phone number is required'}), 400
    if not phone_number.replace('+', '').isdigit(): # Allow '+' at the beginning
        return jsonify({'error': 'Invalid phone number format'}), 400

    # Get a client instance for this request
    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Telegram API credentials not configured.'}), 500
    try:
        # Telethon expects international format, add a basic check/assumption
        # You might want more robust validation here
        # Connect to Telegram
        await client.connect() # Always connect before making a request
        await client.send_code_request(phone_number)
        session['phone_number'] = phone_number  # Store phone number in session
        return jsonify({'message': 'Code request sent successfully'})
    except errors.FloodWaitError as e:
        logging.warning(f"Flood wait during send_code_request: {e.seconds} seconds")
        return jsonify({'error': f'Flood wait: try again in {e.seconds} seconds'}), 420
    except errors.ApiIdInvalidError:
        logging.error("Invalid API ID or API Hash.")
        return jsonify({'error': 'Invalid API ID or API Hash. Please check your .env file.'}), 401
    except Exception as e: # Catch other potential network or API exceptions
        logging.error(f"Error sending code request: {e}", exc_info=True)
        # Differentiate between client-side and server-side errors if possible
@app.route('/sign_in', methods=['POST'])
async def sign_in():
    """
    Signs in the user using the phone number and verification code.
    Requires 'code' in the request JSON body. Phone number is retrieved from session.
    """
    data = request.get_json()
    code = data.get('code', '').strip() # Get code and remove whitespace
    phone_number = session.get('phone_number')

    # Basic input validation
    if not code:
        return jsonify({'error': 'Verification code is required'}), 400
    if not phone_number:
        return jsonify({'error': 'Phone number not found in session. Start with /send_code_request'}), 400
    if not code.isdigit():
         return jsonify({'error': 'Verification code must be numeric'}), 400
    # Note: Telegram codes can vary in length, a strict length check might be too restrictive.

    # Get a client instance for this request
    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Telegram API credentials not configured.'}), 500
    try:
        # Ensure client is connected before signing in
        await client.connect() # Always connect before making a request

        # Attempt to sign in. The user object is returned on success.
        # If successful, we save the session string.
        # Telethon's sign_in can also raise errors.SessionPasswordNeededError
        user = await client.sign_in(phone_number, code)
        if not user: # Should not happen if no exception is raised, but as a safeguard
             raise Exception("Sign-in failed without raising a specific error.")
        session['telegram_authenticated'] = True  # Mark user as authenticated
        session['telegram_session_string'] = client.session.save() # <-- Save session string
        return jsonify({'message': 'Signed in successfully'})
    except errors.SessionPasswordNeededError:
        # If 2FA is required, Telethon raises this error.
 # You might need a separate endpoint to handle 2FA password submission.
        logging.warning("Sign-in requires 2FA password.")
        return jsonify({'error': 'Two-factor authentication is enabled. Password required.'}), 401
    # errors.CodeInvalidError includes errors.CodeExpiredError
    except errors.CodeInvalidError:
         logging.warning("Invalid or expired verification code provided.")
         return jsonify({'error': 'Invalid or expired verification code'}), 400
    except errors.SessionRevokedError:
         return jsonify({'error': 'Session revoked. Please login again.'}), 401
    except Exception as e:
        logging.error(f"Error during sign-in: {e}", exc_info=True)
        if not await client.is_connected():
             return jsonify({'error': 'Failed to connect to Telegram during sign-in. Check network or API credentials.'}), 503 # Service Unavailable
        return jsonify({'error': str(e)}), 500

@app.before_request
async def connect_telegram():
    # This connects the client at the start of each request that is async
    client = get_user_client()
    if client is not None: # Only attempt to connect if client was successfully created
        await client.connect()
@app.route('/is_authenticated', methods=['GET'])
async def is_authenticated():
    """
    Checks if the user is currently authenticated with Telegram.
    """
    try:
        is_authorized = await get_user_client().is_user_authorized() # Use get_user_client directly
        # session['telegram_authenticated'] = is_authorized # Update session status - this might be redundant with checking is_user_authorized on each request
        return jsonify({'authenticated': is_authorized})
    except Exception as e: # Catch potential network issues or other errors
        logging.error(f"Error checking authentication status: {e}", exc_info=True)
        # Return a server error if we can't determine the status
        return jsonify({'error': str(e)}), 500
        pass
        # if client.is_connected(): await client.disconnect()

@app.route('/logout', methods=['POST'])
async def logout():
    """
    Logs out the user from Telegram.
    """
    try:
        client = get_user_client()
        if client is None: # If no client could be created, there's nothing to log out from Telegram
             session.pop('telegram_session_string', None)
             return jsonify({'message': 'Logout successful (no active Telegram session).'})
        await get_user_client().log_out(delete_session=True) # Use get_user_client directly, delete_session=True is sufficient
        session.pop('telegram_session_string', None) # <-- Clear Telethon session from Flask
        session.pop('telegram_authenticated', None) # Remove auth status from session
        return jsonify({'message': 'Logged out successfully, session deleted on Telegram.'})
    except Exception as e:
        logging.error(f"Error during logout: {e}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred during logout'}), 500

@app.route('/get_saved_messages_media', methods=['GET'])
async def get_saved_messages_media():
    """
    Fetches metadata of media items from the user's "Saved Messages".
    Requires user to be authenticated.
    """
    if not session.get('telegram_authenticated'):
        logging.warning("Attempted to fetch media without authentication.")
        return jsonify({'error': 'User not authenticated'}), 401


    client = get_user_client()
    if client is None:
        return jsonify({'error': 'Telegram API credentials not configured.'}), 500
    try:
        # Get the "Saved Messages" entity
        try:
            saved_messages = await client.get_entity('me') # 'me' represents Saved Messages
        except errors.rpcerrorlist.UsernameInvalidError:
             logging.error("Could not get 'me' entity (Saved Messages).")
             return jsonify({'error': 'Could not access Saved Messages'}), 500
        except Exception as e:
             logging.error(f"Error getting 'me' entity: {e}", exc_info=True)
             return jsonify({'error': 'Error accessing Telegram entity'}), 500

        media_items = []
        # Iterate through messages in "Saved Messages"
        # Limit to a certain number of messages for performance
        messages_iterator = client.iter_messages(saved_messages, limit=100, reverse=False) # Get newest messages first
        async for message in messages_iterator: # Using async for for cleaner iteration
            if message.media:
                try:
                    media = message.media
                    media_type = type(media).__name__
                    # Safely get attributes, handling potential None values
                    file_name = getattr(media, 'name', getattr(media, 'file_name', 'Unknown'))
                    mime_type = getattr(media, 'mime_type', 'application/octet-stream')
                    size = getattr(media, 'size', 0)
                    date = message.date.isoformat() if message.date else None
                    caption = message.message if message.message else ''
                # Placeholder URLs - replace with actual streaming endpoints later
                    placeholder_url = f'/stream_media/{message.id}'
                    # Check if thumbnail exists (bytes representation) before creating URL
                    thumbnail_url = f'/stream_thumbnail/{message.id}' if message.media and hasattr(message.media, 'thumbs') and message.media.thumbs else None # Check if 'thumbs' attribute exists

                    media_items.append({
                        'id': str(message.id), # Convert ID to string for JSON
                        'file_name': file_name,
                        'media_type': media_type,
                        'mime_type': mime_type,
                        'size': size,
                        'date': date,
                        'caption': caption,
                        'placeholder_url': placeholder_url,
                        'thumbnail_url': thumbnail_url
                    })
                except Exception as media_err:

        return jsonify(media_items)
    except errors.FloodWaitError as e:
        logging.warning(f"Flood wait during get_saved_messages_media: {e.seconds} seconds")
        return jsonify({'error': f'Flood wait: try again in {e.seconds} seconds'}), 420
    except Exception as e:
        logging.error(f"Error fetching saved messages media: {e}", exc_info=True)
        if not await client.is_connected():
             return jsonify({'error': 'Failed to connect to Telegram while fetching media. Check network or API credentials.'}), 503 # Service Unavailable
        return jsonify({'error': 'An unexpected error occurred while fetching media'}), 500

@app.after_request
@app.route('/upload_file', methods=['POST'])
async def upload_file():
    """
    Receives a file from the frontend and uploads it to the user's "Saved Messages".
    Requires user to be authenticated. Accepts file data and an optional 'caption' field.
    """
    if not session.get('telegram_authenticated'):
        logging.warning("Attempted to upload file without authentication.")
        return jsonify({'error': 'User not authenticated'}), 401

    if 'file' not in request.files:
        logging.warning("Upload file request missing file part.")
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']
    caption = request.form.get('caption', '') # Get optional caption
    # Add basic validation for caption length if needed

    if file.filename == '':
         return jsonify({'error': 'No selected file'}), 400

    # Basic file size check (adjust as needed)
    if file.content_length is not None and file.content_length > 100 * 1024 * 1024: # 100MB limit
         return jsonify({'error': 'File size exceeds limit (100MB)'}), 413 # Payload Too Large

    try:
        # Get a client instance for this request
        client = get_user_client()
        if client is None:
            return jsonify({'error': 'Telegram API credentials not configured.'}), 500
        # send_file can handle large files by streaming
        # Consider adding progress callbacks for large files if needed on the frontend
        logging.info(f"Attempting to upload file: {file.filename}, size: {file.content_length} bytes")

        await client.send_file('me', file.stream, caption=caption, file_size=file.content_length, force_document=True)

        logging.info(f"File upload successful: {file.filename}")

        return jsonify({'message': 'File uploaded successfully'})
    except Exception as e:
        logging.error(f"Error uploading file: {e}", exc_info=True)
        if not await client.is_connected():
             return jsonify({'error': 'Failed to connect to Telegram during upload. Check network or API credentials.'}), 503 # Service Unavailable
@app.route('/stream_media/<int:message_id>', methods=['GET'])
async def stream_media(message_id):
    """
    Fetches and streams a media file from Telegram by message ID.
    Requires user to be authenticated.
    """
    if not session.get('telegram_authenticated'):
        logging.warning(f"Attempted to stream media for message_id {message_id} without authentication.")
        return jsonify({'error': 'User not authenticated'}), 401

    try:
        # Get a client instance for this request
        client = get_user_client()
        if client is None:
            return jsonify({'error': 'Telegram API credentials not configured.'}), 500
        # Get the message object
        # Use get_messages with a list of IDs to handle potential errors for a single ID
        messages = await client.get_messages('me', ids=[message_id])
        message = messages[0] if messages else None # Get the first message if the list is not empty

        if not message:
            logging.warning(f"Message with ID {message_id} not found for streaming.")
            return jsonify({'error': 'Message not found'}), 404

        if not message.media:
            logging.warning(f"Message with ID {message_id} does not contain media for streaming.")
            return jsonify({'error': 'Media not found for this message ID'}), 404

        # Get the file size and mime type for headers
        file_size = getattr(message.media, 'size', None)
        mime_type = getattr(message.media, 'mime_type', 'application/octet-stream')

        logging.info(f"Initiating media stream for message ID: {message_id}")

        # Use download_media with `file` argument to write to a file-like object,
        # then stream from that. For true streaming without writing the whole file
        # to memory/disk first, you might need a custom stream wrapper or a different Telethon approach
        # that allows reading chunks directly.
        # Here, we'll use `BytesIO` as an in-memory file-like object for simplicity,
        # but be mindful of memory for very large files.
        import io
        media_buffer = io.BytesIO()

        # The file argument can be a file path or a file-like object
        # thumb=None ensures we download the full media, not just the thumbnail
        await client.download_media(message, file=media_buffer, thumb=None)
        media_buffer.seek(0) # Rewind the buffer to the beginning

        # Stream the media data back to the frontend
 # Use the generate_chunks helper function we defined
 response = Response(stream_with_context(generate_chunks(media_buffer)), mimetype=mime_type)
        if file_size is not None:
            response.headers['Content-Length'] = file_size
        response.headers['Content-Disposition'] = f'inline; filename="{getattr(message.media, "name", "media")}"'
        return response
    except errors.FloodWaitError as e:
        logging.warning(f"Flood wait during stream_media: {e.seconds} seconds")
        return jsonify({'error': f'Flood wait: try again in {e.seconds} seconds'}), 420
    except errors.MessageIdInvalidError as e: # Catch specific invalid ID error
         logging.warning(f"Invalid message ID {message_id} for media streaming: {e}")
         return jsonify({'error': 'Message ID invalid'}), 400
    except Exception as e:
        logging.error(f"Error streaming media for message ID {message_id}: {e}", exc_info=True)
        if not await client.is_connected():
             return jsonify({'error': 'Failed to connect to Telegram during media streaming. Check network or API credentials.'}), 503 # Service Unavailable
        return jsonify({'error': 'An unexpected error occurred during media streaming'}), 500

@app.route('/stream_thumbnail/<int:message_id>', methods=['GET'])
async def stream_thumbnail(message_id):
    """
    Fetches and streams a thumbnail for a media file from Telegram by message ID.
    Requires user to be authenticated.
    """
    if not session.get('telegram_authenticated'):
        logging.warning(f"Attempted to stream thumbnail for message_id {message_id} without authentication.")
        return jsonify({'error': 'User not authenticated'}), 401

    try:
        # Get a client instance for this request
        client = get_user_client()
        if client is None:
            return jsonify({'error': 'Telegram API credentials not configured.'}), 500
        # Get the message object
        messages = await client.get_messages('me', ids=[message_id])
        message = messages[0] if messages else None

        if not message:
            logging.warning(f"Message with ID {message_id} not found for thumbnail streaming.")
            return jsonify({'error': 'Message not found'}), 404

        if not message.media:
            logging.warning(f"Message with ID {message_id} does not contain media for thumbnail streaming.")
            return jsonify({'error': 'Media not found for this message ID'}), 404

        # Use Telethon's download_media to get the thumbnail as bytes
        # thumb=bytes downloads the thumbnail data directly
        thumbnail_data = await client.download_media(message, thumb=bytes)
        logging.info(f"Downloaded thumbnail data size: {len(thumbnail_data) if thumbnail_data else 0} bytes")

        logging.info(f"Streaming thumbnail for message ID: {message_id}")
        if not thumbnail_data:
            logging.warning(f"No thumbnail data found for message ID {message_id}.")

        if not thumbnail_data:
            return jsonify({'error': 'Thumbnail not available for this media'}), 404

        # Stream the thumbnail data back to the frontend
 # For small thumbnail data, yielding directly or just returning a Response is fine.
 # Using stream_with_context with a generator is still a robust approach.
        def generate_thumbnail_data(data):
        # Common image MIME types, you might need to adjust based on actual thumbnail format
            yield data
        response = Response(stream_with_context(generate_thumbnail_data(thumbnail_data)), mimetype='image/jpeg') # Assuming JPEG thumbnail
        response.headers['Content-Length'] = len(thumbnail_data)
        return response
    except errors.FloodWaitError as e:
        logging.warning(f"Flood wait during stream_thumbnail: {e.seconds} seconds")
        return jsonify({'error': f'Flood wait: try again in {e.seconds} seconds'}), 420
    except Exception as e:
        logging.error(f"Error streaming thumbnail for message ID {message_id}: {e}", exc_info=True)
        if not await client.is_connected():
             return jsonify({'error': 'Failed to connect to Telegram during thumbnail streaming. Check network or API credentials.'}), 503 # Service Unavailable
        return jsonify({'error': 'An unexpected error occurred during thumbnail streaming'}), 500

# Run the Flask app
@app.after_request
async def disconnect_telegram(response):
 client = get_user_client() # Get the client used in the request
 # Ensure the client used in this request context is disconnected
 if client and client.is_connected():
 await client.disconnect()
 return response
if __name__ == '__main__':
    # Use async mode for Telethon
    import asyncio
    # Note: In a production WSGI environment (like Gunicorn),
    # you would use a compatible worker (e.g., gunicorn --worker-class gevent.pywsgi app:app)
    # and manage the Telethon client's lifecycle differently (e.g., in app context setup).
    # Running directly with app.run() and asyncio is suitable for development.
    app.run(debug=True, host='0.0.0.0', port=5000)

    # Manually run the client connect in async mode if running directly
    # with `python app.py`. This might need adjustment based on how you run the app.
    # async def main():
    #      await client.connect()
    #      # Keep the client connected while the Flask app runs
    #      # This requires a different approach for managing the event loop
    #      # than the simple app.run() call above.
    #      pass
    # asyncio.run(main())