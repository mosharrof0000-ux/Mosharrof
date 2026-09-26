"""Mosharrof Storage Engine: indexing and explicitly authorized organization only."""

import os
import shutil
from typing import Dict, Any
from src.core.permission_guard import PermissionGuard


class StorageEngine:
    def __init__(self, root_dir: str = "."):
        self.root_dir = os.path.abspath(root_dir)
        self.file_index: Dict[str, Dict[str, Any]] = {}
        self.junk_extensions = [".tmp", ".log", ".chk", ".bak"]
        self.permission_guard = PermissionGuard(profile="storage", allowed={"READ", "ORGANIZE"})

    def scan_and_index_storage(self, target_path: str = None) -> Dict[str, Any]:
        scan_dir = os.path.abspath(target_path or self.root_dir)
        decision = self.permission_guard.check("READ", scope=scan_dir, entity_scope=scan_dir)
        if decision["status"] != "ALLOWED":
            return decision

        total_files = 0
        junk_found = []
        total_junk_size = 0
        for root, _, files in os.walk(scan_dir):
            for file in files:
                total_files += 1
                file_path = os.path.join(root, file)
                ext = os.path.splitext(file)[1].lower()
                try:
                    file_size = os.path.getsize(file_path)
                    self.file_index[file.lower()] = {
                        "path": file_path, "size_bytes": file_size, "extension": ext
                    }
                    if ext in self.junk_extensions or "cache" in file_path.lower():
                        junk_found.append(file_path)
                        total_junk_size += file_size
                except OSError:
                    continue
        return {
            "status": "SUCCESS",
            "total_files_scanned": total_files,
            "junk_files_count": len(junk_found),
            "reclaimable_mb": round(total_junk_size / (1024 * 1024), 2),
            "junk_list": junk_found[:10],
        }

    def search_file(self, query: str) -> str:
        query_clean = (query or "").lower().strip()
        matched = [
            f"📄 **{name}** -> লোকেশন: `{meta['path']}` ({round(meta['size_bytes']/1024, 1)} KB)"
            for name, meta in self.file_index.items() if query_clean in name
        ]
        if matched:
            return "আপনার ফাইলটি পাওয়া গেছে:\n" + "\n".join(matched[:5])
        return f"দুঃখিত, মেমোরিতে '{query}' নামের কোনো ফাইল খুঁজে পাওয়া যায়নি।"

    def auto_organize_folder(self, folder_path: str) -> Dict[str, Any]:
        folder_path = os.path.abspath(folder_path)
        if not os.path.isdir(folder_path):
            return {"status": "ERROR", "message": "ফোল্ডারটি পাওয়া যায়নি।"}

        decision = self.permission_guard.check(
            "ORGANIZE", scope=folder_path, entity_scope=folder_path
        )
        if decision["status"] != "ALLOWED":
            return decision

        categories = {
            "Documents": [".pdf", ".docx", ".txt", ".xlsx"],
            "Images": [".jpg", ".png", ".jpeg", ".gif"],
            "Audio": [".mp3", ".wav", ".m4a"],
            "Videos": [".mp4", ".mkv"],
            "Archives": [".zip", ".rar", ".7z"],
        }
        moved_count = 0
        for file in os.listdir(folder_path):
            file_path = os.path.join(folder_path, file)
            if not os.path.isfile(file_path):
                continue
            ext = os.path.splitext(file)[1].lower()
            for cat, ext_list in categories.items():
                if ext in ext_list:
                    target_dir = os.path.join(folder_path, cat)
                    target_path = os.path.join(target_dir, file)
                    if os.path.exists(target_path):
                        continue
                    os.makedirs(target_dir, exist_ok=True)
                    shutil.move(file_path, target_path)
                    moved_count += 1
                    break
        return {
            "status": "SUCCESS",
            "moved_files": moved_count,
            "message": f"{moved_count} টি ফাইল ক্যাটাগরি অনুযায়ী ফোল্ডারে গুছিয়ে সাজানো হয়েছে।",
        }
