export function nearestProviderRatio(ratio){
  const parts=String(ratio||"1:1").split(":").map(Number),target=(parts[0]||1)/(parts[1]||1);
  const supported=["1:1","3:2","2:3","4:3","3:4","16:9","9:16","4:5","5:4","21:9"];
  let best="1:1",delta=Infinity;
  for(const r of supported){const p=r.split(":").map(Number),d=Math.abs(Math.log(target/(p[0]/p[1])));if(d<delta){delta=d;best=r;}}
  return best;
}
export function simplifyImageRatio(w,h){let a=w,b=h;while(b){const t=b;b=a%b;a=t;}return (w/a)+":"+(h/a);}
export function parseImageSpec(prompt){
  const original=String(prompt||"");
  const p=original.toLowerCase();
  const dimMatch=original.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  const ratioMatch=original.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  const hasExplicitDimensions=!!dimMatch;
  const hasExplicitRatio=!!ratioMatch;
  let width=0,height=0,ratio="1:1",intent="general";
  const isShort=/youtube\s*shorts|shorts|tiktok|tik tok|reels|reel|vertical video|টিকটক|রিলস|শর্টস/i.test(p);
  const isYouTube=/youtube|ইউটিউব|thumbnail|থাম্বনেইল/i.test(p);
  const isInstagram=/instagram|ইনস্টাগ্রাম/i.test(p);
  const isFacebook=/facebook|ফেসবুক/i.test(p);
  const isIcon=/icon|আইকন|favicon/i.test(p);
  const isWebsite=/website|web image|web graphic|ওয়েবসাইট|ওয়েবসাইট/i.test(p);
  if(isShort){ratio="9:16";intent="short-video";}
  else if(isYouTube){ratio="16:9";intent="youtube";}
  else if(isInstagram){ratio=/portrait|vertical|4\s*:\s*5|পোর্ট্রেট|লম্বা/i.test(p)?"4:5":"1:1";intent="instagram";}
  else if(isFacebook){ratio=/portrait|vertical|পোর্ট্রেট|লম্বা/i.test(p)?"4:5":"16:9";intent="facebook";}
  else if(isIcon){ratio="1:1";intent="icon";}
  else if(isWebsite){ratio="3:2";intent="web";}
  if(hasExplicitRatio){
    const rw=Number(ratioMatch[1]),rh=Number(ratioMatch[2]);
    if(rw>0&&rh>0&&rw<=100&&rh<=100)ratio=rw+":"+rh;
  }
  if(hasExplicitDimensions){
    width=Number(dimMatch[1]);height=Number(dimMatch[2]);
    if(width<1||height<1||width>8192||height>8192)throw new Error("invalid_image_dimensions");
    ratio=simplifyImageRatio(width,height);
  }
  const transparent=/transparent|transparency|স্বচ্ছ ব্যাকগ্রাউন্ড|স্বচ্ছ পটভূমি|ব্যাকগ্রাউন্ড ছাড়া|background\s*remove/i.test(p);
  const formatMatch=p.match(/\b(png|webp|jpe?g)\b/i);
  let format=formatMatch?(formatMatch[1].toLowerCase()==="jpg"?"image/jpeg":"image/"+formatMatch[1].toLowerCase()):"image/webp";
  if(transparent)format="image/png";
  const maxMatch=p.match(/(?:under|below|less than|maximum|max|সর্বোচ্চ|এর কম)\s*(\d+(?:\.\d+)?)\s*(kb|mb|কেবি|এমবি)/i);
  let maxBytes=null;
  if(maxMatch){const amount=Number(maxMatch[1]);const unit=maxMatch[2].toLowerCase();maxBytes=Math.floor(amount*(unit==="kb"||unit==="কেবি"?1000:1000000));}
  else if(/under\s*1\s*mb|less than\s*1\s*mb|১\s*এমবি.?র কম|১\s*এমবি এর কম/i.test(p))maxBytes=1000000;
  let quality="standard",longEdge=0;
  if(/4k|uhd|ultra\s*hd|৪কে/i.test(p)){quality="4K";longEdge=3840;}
  else if(/2k|qhd|quad\s*hd|২কে/i.test(p)){quality="2K";longEdge=2560;}
  else if(/full\s*hd|1080p|ফুল\s*এইচডি/i.test(p)){quality="Full HD";longEdge=1920;}
  else if(/\bhd\b|720p|এইচডি/i.test(p)){quality="HD";longEdge=1280;}
  if(!width||!height){
    const parts=ratio.split(":").map(Number),rw=parts[0]||1,rh=parts[1]||1;
    if(longEdge){
      const ratioValue=rw/rh;
      if(ratioValue>16/9){
        const targetHeight=quality==="4K"?2160:(quality==="2K"?1440:(quality==="Full HD"?1080:720));
        height=targetHeight;width=Math.max(1,Math.round(targetHeight*ratioValue));
      }else if(rw>=rh){width=longEdge;height=Math.max(1,Math.round(longEdge*rh/rw));}
      else{height=longEdge;width=Math.max(1,Math.round(longEdge*rw/rh));}
    }else if(intent==="youtube"){width=1280;height=720;}
    else if(intent==="short-video"){width=1080;height=1920;}
    else if(intent==="instagram"&&ratio==="4:5"){width=1080;height=1350;}
    else if(intent==="instagram"){width=1080;height=1080;}
    else if(intent==="facebook"&&ratio==="4:5"){width=1080;height=1350;}
    else if(intent==="facebook"){width=1200;height=675;}
    else if(intent==="icon"){width=512;height=512;}
    else if(intent==="web"){width=1200;height=800;}
    else {const base=1024;if(rw>=rh){width=base;height=Math.max(1,Math.round(base*rh/rw));}else{height=base;width=Math.max(1,Math.round(base*rw/rh));}}
  }
  const pixels=width*height;
  const imageSize=(Math.max(width,height)>=3500||quality==="4K")?"4K":(quality==="2K"||pixels>1800000||Math.max(width,height)>=2000)?"2K":"1K";
  return {intent,aspect_ratio:ratio,provider_aspect_ratio:nearestProviderRatio(ratio),width,height,format,transparent,max_bytes:maxBytes,quality,image_size:imageSize,explicit_dimensions:hasExplicitDimensions,explicit_ratio:hasExplicitRatio};
}
