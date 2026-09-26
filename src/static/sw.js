/*
 Mosharrof AI: Autonomous Auto-Update Service Worker
 সার্ভারে বা গিটহাবে নতুন কোনো আপডেট আসলে অ্যাপে স্বয়ংক্রিয়ভাবে লাইভ আপডেট এনে দেয়।
*/

const CACHE_NAME = 'mosharrof-ai-v1';

// ১. নতুন আপডেট আসামাত্রই পুরোনো ক্যাশ মুছে দ্রুত নতুন আপডেট গ্রহণ করা
self.addEventListener('install', (event) => {
    self.skipWaiting(); // তাৎক্ষণিক নতুন ভার্সন অ্যাক্টিভ করা
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache); // পুরোনো ভার্সনের অবশিষ্টাংশ পরিষ্কার
                    }
                })
            );
        }).then(() => self.clients.claim()) // সব ডিভাইস স্ক্রিনে সাথে সাথে আপডেট পুশ করা
    );
});

// ২. নেটওয়ার্ক ফার্স্ট স্ট্র্যাটেজি (সবসময় সার্ভার থেকে ফ্রেশ ডাটা ও ফিচার ফেচ করবে)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
