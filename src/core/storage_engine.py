"""Indexed storage utilities. This engine never deletes files."""
import os
import shutil
from typing import Dict, Any
from src.core.permission_policy import PermissionPolicy

class StorageEngine:
    def __init__(self, root_dir: str=".", permission_policy=None):
        self.root_dir=root_dir
        self.file_index: Dict[str,Dict[str,Any]]={}
        self.junk_extensions=[".tmp",".log",".chk",".bak"]
        self.permission_policy=permission_policy or PermissionPolicy({"READ","MOVE"})

    def scan_and_index_storage(self,target_path: str=None)->Dict[str,Any]:
        scan_dir=target_path or self.root_dir
        total_files=0; junk_found=[]; total_junk_size=0
        for root,_,files in os.walk(scan_dir):
            for file in files:
                total_files+=1
                file_path=os.path.join(root,file)
                try:
                    file_size=os.path.getsize(file_path); ext=os.path.splitext(file)[1].lower()
                    self.file_index[file.lower()]={"path":file_path,"size_bytes":file_size,"extension":ext}
                    if ext in self.junk_extensions or "cache" in file_path.lower():
                        junk_found.append(file_path); total_junk_size+=file_size
                except OSError: continue
        return {"status":"SUCCESS","total_files_scanned":total_files,"junk_files_count":len(junk_found),"reclaimable_mb":round(total_junk_size/(1024*1024),2),"junk_list":junk_found[:10]}

    def search_file(self,query: str)->str:
        query_clean=query.lower().strip()
        matched=[f"{name} -> {meta['path']} ({round(meta['size_bytes']/1024,1)} KB)" for name,meta in self.file_index.items() if query_clean in name]
        return ("File(s) found:\n"+"\n".join(matched[:5])) if matched else f"No file matching '{query}' was found."

    def auto_organize_folder(self,folder_path: str)->Dict[str,Any]:
        permission=self.permission_policy.check("MOVE")
        if permission["status"]!="ALLOWED": return permission
        if not os.path.isdir(folder_path): return {"status":"ERROR","message":"Folder not found."}
        categories={"Documents":[".pdf",".docx",".txt",".xlsx"],"Images":[".jpg",".png",".jpeg",".gif"],"Audio":[".mp3",".wav",".m4a"],"Videos":[".mp4",".mkv"],"Archives":[".zip",".rar",".7z"]}
        moved_count=0
        for file in os.listdir(folder_path):
            file_path=os.path.join(folder_path,file)
            if not os.path.isfile(file_path): continue
            ext=os.path.splitext(file)[1].lower()
            category=next((c for c,exts in categories.items() if ext in exts),None)
            if not category: continue
            target_dir=os.path.join(folder_path,category); os.makedirs(target_dir,exist_ok=True)
            destination=os.path.join(target_dir,file)
            if os.path.exists(destination): continue
            shutil.move(file_path,destination); moved_count+=1
        return {"status":"SUCCESS","moved_files":moved_count}
