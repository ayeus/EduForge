# utils/s3_utils.py
import boto3
import os
import mimetypes
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# S3 client configuration
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

def upload_file_to_s3(file, filename):
    """
    Upload a file to S3 and return the public URL.
    :param file: File object (e.g., from a form upload)
    :param filename: Name to save the file as in S3
    :return: Public URL of the uploaded file
    """
    bucket_name = os.getenv('S3_BUCKET_NAME')
    try:
        # Determine the content type based on the filename
        content_type, _ = mimetypes.guess_type(filename)
        content_type = content_type or "application/octet-stream"  # Fallback if unknown

        # Upload the file
        s3_client.upload_fileobj(
            file,
            bucket_name,
            filename,
            ExtraArgs={'ACL': 'public-read', 'ContentType': content_type}
        )
        # Construct the public URL
        file_url = f"https://{bucket_name}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{filename}"
        return file_url
    except ClientError as e:
        print(f"Error uploading file to S3: {e}")
        return None