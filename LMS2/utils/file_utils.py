ALLOWED_EXTENSIONS = {"webm", "mp4", "ogg"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS