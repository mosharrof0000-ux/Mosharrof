"""
Mosharrof AI: Storage Index and Organizer Engine.
Scanning is read-only. Organization is an explicit MOVE operation; DELETE is never used.
"""
import os
import shutil
from typing import Dict, Any
from src.core.policy_engine import PolicyEngine

class StorageEngine:
    def __init__(self, root_dir: str = ".", policy_engine: PolicyEngine | None = None):
        self.root_dir = root_dir
        self.file_index: Dict[str, Dict[str, Any]] = {}
        self.policy_engine = policy_engine or PolicyEngine()
        self.junk_extensions = [".tmp", ".log", ".chk", ".bak"]

    def scan_and_index_storage(self, target_path: str | None = None) -> Dict[str, Any]:
        scan_dir = target_path or self.root_dir
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
                    self.file_index[file.lower()] = {"path": file_path, "size_bytes": file_size, "extension": ext}
                    if ext in self.junk_extensions or "cache" in file_path.lower():
                        junk_found.append(file_path)
                        total_junk_size += file_size
                except OSError:
                    continue
        return {"status":"SUCCESS","total_files_scanned":total_files,"junk_files_count":len(junk_found),
                "reclaimable_mb":round(total_junk_size/(1024*1024),2),"junk_list":junk_found[:10]}

    def search_file(self, query: str) -> str:
        query_clean = query.lower().strip()
        matched = [f"{name} -> {meta['path']} ({round(meta['size_bytes']/1024,1)} KB)"
                   for name, meta in self.file_index.items() if query_clean in name]
        return ("Files found:\n" + "\n".join(matched[:5])) if matched else f"No file matching '{query}' was found."

    def auto_organize_folder(self, folder_path: str) -> Dict[str, Any]:
        decision = self.policy_engine.authorize("MOVE", scope=f"folder:{folder_path}")
        if decision["status"] != "ALLOWED":
            return decision
        if not os.path.exists(folder_path):
            return {"status":"ERROR","message":"Folder not found."}
        categories = {"Documents":[".pdf",".docx",".txt",".xlsx"],"Images":[".jpg",".png",".jpeg",".gif"],
                      "Audio":[".mp3",".wav",".m4a"],"Videos":[".mp4",".mkv"],"Archives":[".zip",".rar",".7z"]}
        moved_count = 0
        for file in os.listdir(folder_path):
            file_path = os.path.join(folder_path,file)
            if not os.path.isfile(file_path):
                continue
            ext = os.path.splitext(file)[1].lower()
            for category, extensions in categories.items():
                if ext in extensions:
                    target_dir = os.path.join(folder_path,category)
                    os.makedirs(target_dir,exist_ok=True)
                    shutil.move(file_path,os.path.join(target_dir,file))
                    moved_count += 1
                    break
        return {"status":"SUCCESS","moved_files":moved_count}
