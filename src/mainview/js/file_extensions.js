var extension_categories_11 = {
  archive:
    '7z,a,apk,ar,bz2,cab,cpio,deb,dmg,egg,gz,iso,jar,lha,mar,pea,rar,rpm,s7z,shar,tar,tbz2,tgz,tlz,war,whl,xpi,zip,zipx,deb,rpm,xz,pak,crx,exe,msi,bin',
  audio: 'aac,aiff,ape,au,flac,gsm,it,m3u,m4a,mid,mod,mp3,mpa,pls,ra,s3m,sid,wav,wma,xm',
  code:
    'c,cc,class,clj,cpp,cs,cxx,el,go,h,java,lua,m,m4,php,pl,po,py,rb,rs,sh,swift,vb,vcxproj,xcodeproj,xml,diff,patch',
  font: 'eot,otf,ttf,woff,woff2',
  image: '3dm,3ds,max,bmp,dds,gif,jpg,jpeg,png,psd,xcf,tga,thm,tif,tiff,yuv,ai,eps,ps,svg,dwg,dxf,gpx,kml,kmz,webp',
  sheet: 'ods,xls,xlsx,csv,ics,vcf',
  slide: 'ppt,odp',
  text: 'doc,docx,ebook,log,md,msg,odt,org,pages,pdf,rtf,rst,tex,txt,wpd,wps',
  video:
    '3g2,3gp,aaf,asf,avchd,avi,drc,flv,m2v,m4p,m4v,mkv,mng,mov,mp2,mp4,mpe,mpeg,mpg,mpv,mxf,nsv,ogg,ogv,ogm,qt,rm,rmvb,roq,srt,svi,vob,webm,wmv,yuv',
  web: 'html,htm,css,js,jsx,less,scss,wasm'
}

/* 6 categories */
var extension_categories_6 = {
  media:
    'aac,au,flac,mid,midi,mka,mp3,mpc,ogg,opus,ra,wav,m4a,axa,oga,spx,xspf,mov,MOV,mpg,mpeg,m2v,mkv,ogm,mp4,m4v,mp4v,vob,qt,nuv,wmv,asf,rm,rmvb,flc,avi,fli,flv,gl,m2ts,divx,webm,axv,anx,ogv,ogx',
  image:
    'jpg,JPG,jpeg,gif,bmp,pbm,pgm,ppm,tga,xbm,xpm,tif,tiff,png,PNG,svg,svgz,mng,pcx,dl,xcf,xwd,yuv,cgm,emf,eps,CR2,ico',
  code:
    'tex,rdf,owl,n3,ttl,nt,torrent,xml,*Makefile,*Rakefile,*Dockerfile,*build.xml,*rc,*1,nfo,*README,*README.txt,*readme.txt,md,*README.markdown,ini,yml,cfg,conf,h,hpp,c,cpp,cxx,cc,objc,sqlite,go,sql,csv',
  archive:
    'tar,tgz,arj,taz,lzh,lzma,tlz,txz,zip,z,Z,dz,gz,lz,xz,bz2,bz,tbz,tbz2,tz,deb,rpm,jar,rar,ace,zoo,cpio,7z,rz,apk,gem',
  obj: 'log,bak,aux,lof,lol,lot,out,toc,bbl,blg,*,part,incomplete,swp,tmp,temp,o,pyc,class,cache',
  doc: 'doc,docx,rtf,odt,dot,dotx,ott,xls,xlsx,ods,ots,ppt,pptx,odp,otp,fla,psd'
}

function build_reverse_map(map) {
  var reverse_map = {}

  for (var type in map) {
    map[type]
      .split(',')
      .map(e => `.${e}`)
      .forEach(k => {
        reverse_map[k] = type
      })
  }

  return reverse_map
}

window.extension_categories_11 = build_reverse_map(extension_categories_11)
window.extension_categories_6 = build_reverse_map(extension_categories_6)
