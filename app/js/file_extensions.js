// using data from https://github.com/dyne/file-extension-list

/*
dirs = fs.readdirSync('./')
extension_categories = {}
dirs.forEach(cat => { d = fs.readFileSync(cat, 'utf-8'); extension_categories[cat] = d.split('\n').join(',') })
*/

var extension_categories = {
    archiv: '7z,a,apk,ar,bz2,cab,cpio,deb,dmg,egg,gz,iso,jar,lha,mar,pea,rar,rpm,s7z,shar,tar,tbz2,tgz,tlz,war,whl,xpi,zip,zipx,deb,rpm,xz,pak,crx,exe,msi,bin',
    audio: 'aac,aiff,ape,au,flac,gsm,it,m3u,m4a,mid,mod,mp3,mpa,pls,ra,s3m,sid,wav,wma,xm',
    code: 'c,cc,class,clj,cpp,cs,cxx,el,go,h,java,lua,m,m4,php,pl,po,py,rb,rs,sh,swift,vb,vcxproj,xcodeproj,xml,diff,patch',
    font: 'eot,otf,ttf,woff,woff2',
    image: '3dm,3ds,max,bmp,dds,gif,jpg,jpeg,png,psd,xcf,tga,thm,tif,tiff,yuv,ai,eps,ps,svg,dwg,dxf,gpx,kml,kmz,webp',
    sheet: 'ods,xls,xlsx,csv,ics,vcf',
    slide: 'ppt,odp',
    text: 'doc,docx,ebook,log,md,msg,odt,org,pages,pdf,rtf,rst,tex,txt,wpd,wps',
    video: '3g2,3gp,aaf,asf,avchd,avi,drc,flv,m2v,m4p,m4v,mkv,mng,mov,mp2,mp4,mpe,mpeg,mpg,mpv,mxf,nsv,ogg,ogv,ogm,qt,rm,rmvb,roq,srt,svi,vob,webm,wmv,yuv',
    web: 'html,htm,css,js,jsx,less,scss,wasm'
};

