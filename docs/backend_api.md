# Backend API Documentation

## Introduction

This document provides detailed documentation for the Python Flask backend API that serves as an intermediary between the Next.js frontend and the Telegram API using the Telethon library. The backend is responsible for securely handling Telegram API interactions, including user authentication, media fetching, uploading, and streaming, without exposing sensitive API keys to the client-side.

## Setup Instructions

1.  **Clone the repository:** Clone the project repository to your local machine.
2.  **Navigate to the backend directory:** Change your current directory to the backend directory (where `app.py` is located).
3.  **Create a virtual environment (recommended):**
```
bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    
```
4.  **Install dependencies:** Install the required Python packages using pip and the `requirements.txt` file.
```
bash
    pip install -r requirements.txt
    
```
5.  **Create a `.env` file:** Create a file named `.env` in the backend directory and add your Telegram API credentials:
```
env
    TELEGRAM_API_ID=your_api_id
    TELEGRAM_API_HASH=your_api_hash
    
```
Replace `your_api_id` and `your_api_hash` with your actual Telegram API credentials obtained from my.telegram.org.
6.  **Run the Flask application:**
```
bash
    flask run
    
```
For production, use a WSGI server like Gunicorn:
```
bash
    gunicorn -w 4 app:app
    
```
## Endpoint Documentation

### `/send-code`

Initiates the Telegram phone number login process by sending a verification code to the provided phone number.

*   **URL:** `/send-code`
*   **Method:** `POST`
*   **Parameters:**
    *   `phone` (string, required): The user's phone number in international format (e.g., `+15551234567`).
*   **Example Request (using fetch in frontend):**
```
javascript
    fetch('/send-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: '+15551234567' }),
    });
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        {
          "message": "Code sent successfully."
        }
        
```
*   **Possible Error Responses:**
    *   **Status Code:** `400 Bad Request`
        *   **Body:**
```
json
            {
              "error": "Phone number is required."
            }
            
```
(If phone number is missing)
        *   **Body:**
```
json
            {
              "error": "Invalid phone number format."
            }
            
```
(If phone number format is invalid)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to send code. Please try again.",
              "details": "..." // More specific error details
            }
            
```
(For general errors during code sending)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

### `/sign-in`

Completes the Telegram phone number login process using the verification code received by the user and their phone number.

*   **URL:** `/sign-in`
*   **Method:** `POST`
*   **Parameters:**
    *   `phone` (string, required): The user's phone number (same as used for `/send-code`).
    *   `code` (string, required): The verification code received by the user.
*   **Example Request:**
```
javascript
    fetch('/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: '+15551234567', code: '12345' }),
    });
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        {
          "message": "Signed in successfully."
          // Potentially include some basic user info if needed by frontend
        }
        
```
*   **Possible Error Responses:**
    *   **Status Code:** `400 Bad Request`
        *   **Body:**
```
json
            {
              "error": "Phone number and code are required."
            }
            
```
(If parameters are missing)
        *   **Body:**
```
json
            {
              "error": "Invalid code. Please try again."
            }
            
```
(If the provided code is incorrect)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to sign in. Please try again.",
              "details": "..." // More specific error details
            }
            
```
(For general errors during sign in)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

### `/is-authenticated`

Checks if the current user session is authenticated with the Telegram API.

*   **URL:** `/is-authenticated`
*   **Method:** `GET`
*   **Parameters:** None
*   **Example Request:**
```
javascript
    fetch('/is-authenticated');
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        {
          "authenticated": true
        }
        
```
(If the user is authenticated)
    *   **Body:**
```
json
        {
          "authenticated": false
        }
        
```
(If the user is not authenticated)
*   **Possible Error Responses:**
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to check authentication status.",
              "details": "..." // More specific error details
            }
            
```
(For errors during the check)

### `/logout`

Logs out the current user from the Telegram API session.

*   **URL:** `/logout`
*   **Method:** `POST`
*   **Parameters:** None
*   **Example Request:**
```
javascript
    fetch('/logout', {
      method: 'POST',
    });
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        {
          "message": "Logged out successfully."
        }
        
```
*   **Possible Error Responses:**
    *   **Status Code:** `401 Unauthorized`
        *   **Body:**
```
json
            {
              "error": "User not authenticated."
            }
            
```
(If the user is not authenticated)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to log out.",
              "details": "..." // More specific error details
            }
            
```
(For errors during logout)

### `/get-saved-messages-media`

Fetches metadata (name, type, timestamp, size) for media items in the user's "Saved Messages".

*   **URL:** `/get-saved-messages-media`
*   **Method:** `GET`
*   **Parameters:** None
*   **Example Request:**
```
javascript
    fetch('/get-saved-messages-media');
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        [
          {
            "id": 123,
            "name": "image.jpg",
            "type": "photo",
            "timestamp": "2023-10-27T10:00:00Z",
            "size": 102400,
            "caption": "A beautiful image",
            "has_thumbnail": true
          },
          // ... more media items
        ]
        
```
*   **Possible Error Responses:**
    *   **Status Code:** `401 Unauthorized`
        *   **Body:**
```
json
            {
              "error": "User not authenticated."
            }
            
```
(If the user is not authenticated)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to fetch media from Saved Messages.",
              "details": "..." // More specific error details
            }
            
```
(For errors during fetching)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

### `/upload_file`

Uploads a file from the frontend to the user's "Saved Messages" in Telegram.

*   **URL:** `/upload_file`
*   **Method:** `POST`
*   **Parameters:**
    *   `file` (file, required): The file to upload.
    *   `caption` (string, optional): A caption for the uploaded file.
*   **Example Request (using FormData in frontend):**
```
javascript
    const formData = new FormData();
    formData.append('file', yourFileObject);
    formData.append('caption', 'My uploaded file');

    fetch('/upload_file', {
      method: 'POST',
      body: formData,
    });
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:**
```
json
        {
          "message": "File uploaded successfully.",
          "message_id": 456 // ID of the sent message in Telegram
        }
        
```
*   **Possible Error Responses:**
    *   **Status Code:** `401 Unauthorized`
        *   **Body:**
```
json
            {
              "error": "User not authenticated."
            }
            
```
(If the user is not authenticated)
    *   **Status Code:** `400 Bad Request`
        *   **Body:**
```
json
            {
              "error": "No file provided in the request."
            }
            
```
(If no file is included in the request)
        *   **Body:**
```
json
            {
              "error": "Invalid file type or format."
            }
            
```
(If basic file type validation fails)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to upload file to Telegram.",
              "details": "..." // More specific error details
            }
            
```
(For errors during upload)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

### `/stream_media/<int:message_id>`

Streams the content of a media file from a specific message ID in Telegram.

*   **URL:** `/stream_media/<int:message_id>`
*   **Method:** `GET`
*   **Parameters:**
    *   `message_id` (integer, required): The ID of the message in Telegram containing the media.
*   **Example Request:**
```
javascript
    fetch('/stream_media/123'); // Assuming message ID is 123
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:** The raw content of the media file is streamed directly as the response body. The `Content-Type` header will be set appropriately based on the media type.
*   **Possible Error Responses:**
    *   **Status Code:** `401 Unauthorized`
        *   **Body:**
```
json
            {
              "error": "User not authenticated."
            }
            
```
(If the user is not authenticated)
    *   **Status Code:** `404 Not Found`
        *   **Body:**
```
json
            {
              "error": "Media not found or message ID is invalid."
            }
            
```
(If the message ID is invalid or no media is found)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to stream media.",
              "details": "..." // More specific error details
            }
            
```
(For errors during streaming)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

### `/stream_thumbnail/<int:message_id>`

Streams the thumbnail of a media item from a specific message ID in Telegram.

*   **URL:** `/stream_thumbnail/<int:message_id>`
*   **Method:** `GET`
*   **Parameters:**
    *   `message_id` (integer, required): The ID of the message in Telegram containing the media with a thumbnail.
*   **Example Request:**
```
javascript
    fetch('/stream_thumbnail/123'); // Assuming message ID is 123
    
```
*   **Success Response:**
    *   **Status Code:** `200 OK`
    *   **Body:** The raw content of the thumbnail image is streamed directly as the response body. The `Content-Type` header will typically be `image/jpeg` or `image/png`.
*   **Possible Error Responses:**
    *   **Status Code:** `401 Unauthorized`
        *   **Body:**
```
json
            {
              "error": "User not authenticated."
            }
            
```
(If the user is not authenticated)
    *   **Status Code:** `404 Not Found`
        *   **Body:**
```
json
            {
              "error": "Thumbnail not found for this message or message ID is invalid."
            }
            
```
(If the message ID is invalid or no thumbnail is found)
    *   **Status Code:** `500 Internal Server Error`
        *   **Body:**
```
json
            {
              "error": "Failed to stream thumbnail.",
              "details": "..." // More specific error details
            }
            
```
(For errors during streaming)
    *   **Status Code:** `429 Too Many Requests`
        *   **Body:**
```
json
            {
              "error": "Too many requests. Please try again later.",
              "retry_after": <seconds>
            }
            
```
(If Telegram API rate limits are hit - FloodWaitError)

## Error Handling and Edge Cases

The backend implements error handling to provide informative responses to the frontend. Key aspects include:

*   **Authentication Checks:** Most endpoints require user authentication and return a `401 Unauthorized` error if the user is not logged in.
*   **Input Validation:** Basic validation is performed on incoming data (e.g., checking for required parameters, basic format checks). Missing or invalid input results in `400 Bad Request`.
*   **Telegram API Errors:** Exceptions raised by the Telethon library during communication with the Telegram API are caught. Specific errors like `FloodWaitError` (indicating rate limits) are handled, returning a `429 Too Many Requests` with a `retry_after` field. Other API errors are caught and returned as `500 Internal Server Error` with details where possible.
*   **Resource Not Found:** When attempting to fetch or stream media/thumbnails, if the provided `message_id` is invalid, does not exist, or the message does not contain the requested media/thumbnail, a `404 Not Found` error is returned.
*   **Internal Server Errors:** General exceptions or errors not specifically handled are caught and returned as `500 Internal Server Error`, often with some details about the error for debugging purposes.
*   **Resource Management:** The Telethon client is managed within the request context to ensure it is properly disconnected and resources are released, even in case of errors.

The frontend should be designed to handle these different status codes and error response bodies gracefully, displaying appropriate messages to the user.