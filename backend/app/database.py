from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Global database connection
db = None

def init_db():
    global db
    MONGODB_URI = os.getenv('MONGODB_URI')
    
    if not MONGODB_URI:
        raise Exception("❌ MONGODB_URI not found in .env file")
    
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_database()
        client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas!")
        print(f"📊 Database: {db.name}")
        return db
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise e

def get_db():
    global db
    if db is None:
        db = init_db()
    return db