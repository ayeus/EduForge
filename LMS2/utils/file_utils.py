

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {"webm", "mp4", "ogg"}

    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS