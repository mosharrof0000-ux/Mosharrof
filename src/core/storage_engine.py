"""
Mosharrof AI: Autonomous Device Storage & Memory Optimizer Engine
মেমোরির অনাবশ্যক ডাটা শনাক্তকরণ, অটো-ফাইল সর্টিং এবং প্রাকৃতিক ভাষায় স্টোরেজ অনুসন্ধান ইঞ্জিন।
"""

import os
import shutil
from typing import Dict, Any, List
from src.core.permission_engine import PermissionEngine

class StorageEngine:
    def __init__(self, root_dir: str = "."):
        self.root_dir = root_dir
        self.file_index: Dict[str, Dict[str, Any]] = {}
        self.junk_extensions = [".tmp", ".log", ".chk", ".bak"]
        self.permission_engine = PermissionEngine()

    def scan_and_index_storage(self, target_path: str = None) -> Dict[str, Any]:
        """মেমোরির প্রতিটি ফাইলের অবস্থান ইনডেক্স করা এবং জাঙ্ক ফাইল আলাদা করা"""
        scan_dir = target_path or self.root_dir
        total_files = 0
        junk_found = []
        total_junk_size = 0

        for root, _, files in os.walk(scan_dir):
            for file in files:
                total_files += 1
                file_path = os.path.join(root, file)
                ext = os.path.splitext(file)[1].lower()

                # ফাইলের তথ্য ইনডেক্স করা
                try:
                    file_size = os.path.getsize(file_path)
                    self.file_index[file.lower()] = {
                        "path": file_path,
                        "size_bytes": file_size,
                        "extension": ext
                    }

                    # অনাবশ্যক বা ক্যাশ ফাইল চিহ্নিত করা
                    if ext in self.junk_extensions or "cache" in file_path.lower():
                        junk_found.append(file_path)
                        total_junk_size += file_size
                except Exception:
                    continue

        return {
            "status": "SUCCESS",
            "total_files_scanned": total_files,
            "junk_files_count": len(junk_found),
            "reclaimable_mb": round(total_junk_size / (1024 * 1024), 2),
            "junk_list": junk_found[:10]  # নমুনা ১০টি জাঙ্ক ফাইল
        }

    def search_file(self, query: str) -> str:
        """ইউজার মুখে বা টেক্সটে ফাইলের কথা জিজ্ঞাসা করলে সাথে সাথে তার সঠিক অবস্থান বলা"""
        query_clean = query.lower().strip()
        matched = []

        for name, meta in self.file_index.items():
            if query_clean in name:
                matched.append(f"📄 **{name}** -> লোকেশন: `{meta['path']}` ({round(meta['size_bytes']/1024, 1)} KB)")

        if matched:
            return "আপনার ফাইলটি পাওয়া গেছে:\n" + "\n".join(matched[:5])
        return f"দুঃখিত, মেমোরিতে '{query}' নামের কোনো ফাইল খুঁজে পাওয়া যায়নি।"

    def auto_organize_folder(self, folder_path: str) -> Dict[str, Any]:
        """এলোমেলো ফোল্ডার থেকে টাইপ অনুযায়ী ফাইল আলাদা করে সাজানো।"""
        decision = self.permission_engine.authorize("MOVE_FILES", scope=folder_path)
        if decision["status"] != "ALLOWED":
            return decision
        if not os.path.isdir(folder_path):
            return {"status": "ERROR", "message": "ফোল্ডারটি পাওয়া যায়নি।"}

        categories = {
            "Documents": [".pdf", ".docx", ".txt", ".xlsx"],
            "Images": [".jpg", ".png", ".jpeg", ".gif"],
            "Audio": [".mp3", ".wav", ".m4a"],
            "Videos": [".mp4", ".mkv"],
            "Archives": [".zip", ".rar", ".7z"]
        }

        moved_count = 0
        for file in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file)
            if os.path.isfile(file_path):
                ext = os.path.splitext(file)[1].lower()
                for cat, ext_list in categories.items():
                    if ext in ext_list:
                        target_dir = os.path.join(folder_path, cat)
                        os.makedirs(target_dir, exist_ok=True)
                        destination = os.path.join(target_dir, file)
                        if os.path.exists(destination):
                            continue
                        shutil.move(file_path, destination)
                        moved_count += 1
                        break

        return {
            "status": "SUCCESS",
            "moved_files": moved_count,
            "operation": "MOVE_FILES",
            "message": f"{moved_count} টি ফাইল ক্যাটাগরি অনুযায়ী ফোল্ডারে গুছিয়ে সাজানো হয়েছে।"
        }
