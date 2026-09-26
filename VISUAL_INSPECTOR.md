# Mosharrof Visual Inspector

প্রতিটি PR-এ Mosharrof-এর প্রস্তাবিত UI একটি বাস্তব Chromium browser-এ খুলে mobile ও desktop screenshot নেয়। Required UI, horizontal overflow এবং approved structural baseline পরীক্ষা করে। Screenshot ও report workflow artifact হিসেবে রাখা হয়।

এটি production-এর বাইরে চলে। Agent সরাসরি main পরিবর্তন করতে পারে না। ভবিষ্যতে vision-capable connected AI-কে PNG পাঠিয়ে structured visual PASS/FAIL review যোগ করা যাবে; সেই AI-কে repository write access দেওয়া হবে না।