# test_s3.py
import boto3
import os
from dotenv import load_dotenv

load_dotenv()
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

bucket_name = os.getenv('S3_BUCKET_NAME')
try:
    s3_client.head_bucket(Bucket=bucket_name)
    print(f"Successfully accessed bucket: {bucket_name}")
except Exception as e:
    print(f"Error accessing bucket: {e}")