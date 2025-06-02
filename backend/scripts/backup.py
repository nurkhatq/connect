import asyncio
import os
import subprocess
from datetime import datetime
from config import settings

async def backup_database():
    """Create database backup"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"aitu_backup_{timestamp}.sql"
    backup_path = os.path.join("backups", backup_filename)
    
    # Create backups directory if it doesn't exist
    os.makedirs("backups", exist_ok=True)
    
    # Extract database info from URL
    db_url = settings.database_url
    # postgresql://user:password@host:port/database
    
    try:
        # Run pg_dump
        cmd = [
            "pg_dump",
            db_url,
            "-f", backup_path,
            "--verbose",
            "--clean",
            "--if-exists",
            "--create"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Database backup created: {backup_path}")
            
            # Compress backup
            subprocess.run(["gzip", backup_path])
            print(f"✅ Backup compressed: {backup_path}.gz")
            
        else:
            print(f"❌ Backup failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Backup error: {e}")

async def restore_database(backup_file: str):
    """Restore database from backup"""
    if not os.path.exists(backup_file):
        print(f"❌ Backup file not found: {backup_file}")
        return
    
    # Decompress if needed
    if backup_file.endswith('.gz'):
        subprocess.run(["gunzip", backup_file])
        backup_file = backup_file[:-3]  # Remove .gz extension
    
    try:
        cmd = [
            "psql",
            settings.database_url,
            "-f", backup_file,
            "--verbose"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Database restored from: {backup_file}")
        else:
            print(f"❌ Restore failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Restore error: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        if len(sys.argv) > 2:
            asyncio.run(restore_database(sys.argv[2]))
        else:
            print("Usage: python backup.py restore <backup_file>")
    else:
        asyncio.run(backup_database())
