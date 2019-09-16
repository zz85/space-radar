const color_reg = /([^ ]+)\W+([\d;]+)/

const extension_map = {}
const all_types = new Set()
const color_types = new Set()
let description = []

// https://github.com/sindresorhus/xterm-colors/blob/master/xterm-colors.json
const xterm_colors = [
  '000000',
  '800000',
  '008000',
  '808000',
  '000080',
  '800080',
  '008080',
  'c0c0c0',
  '808080',
  'ff0000',
  '00ff00',
  'ffff00',
  '0000ff',
  'ff00ff',
  '00ffff',
  'ffffff',
  '000000',
  '00005f',
  '000087',
  '0000af',
  '0000d7',
  '0000ff',
  '005f00',
  '005f5f',
  '005f87',
  '005faf',
  '005fd7',
  '005fff',
  '008700',
  '00875f',
  '008787',
  '0087af',
  '0087d7',
  '0087ff',
  '00af00',
  '00af5f',
  '00af87',
  '00afaf',
  '00afd7',
  '00afff',
  '00d700',
  '00d75f',
  '00d787',
  '00d7af',
  '00d7d7',
  '00d7ff',
  '00ff00',
  '00ff5f',
  '00ff87',
  '00ffaf',
  '00ffd7',
  '00ffff',
  '5f0000',
  '5f005f',
  '5f0087',
  '5f00af',
  '5f00d7',
  '5f00ff',
  '5f5f00',
  '5f5f5f',
  '5f5f87',
  '5f5faf',
  '5f5fd7',
  '5f5fff',
  '5f8700',
  '5f875f',
  '5f8787',
  '5f87af',
  '5f87d7',
  '5f87ff',
  '5faf00',
  '5faf5f',
  '5faf87',
  '5fafaf',
  '5fafd7',
  '5fafff',
  '5fd700',
  '5fd75f',
  '5fd787',
  '5fd7af',
  '5fd7d7',
  '5fd7ff',
  '5fff00',
  '5fff5f',
  '5fff87',
  '5fffaf',
  '5fffd7',
  '5fffff',
  '870000',
  '87005f',
  '870087',
  '8700af',
  '8700d7',
  '8700ff',
  '875f00',
  '875f5f',
  '875f87',
  '875faf',
  '875fd7',
  '875fff',
  '878700',
  '87875f',
  '878787',
  '8787af',
  '8787d7',
  '8787ff',
  '87af00',
  '87af5f',
  '87af87',
  '87afaf',
  '87afd7',
  '87afff',
  '87d700',
  '87d75f',
  '87d787',
  '87d7af',
  '87d7d7',
  '87d7ff',
  '87ff00',
  '87ff5f',
  '87ff87',
  '87ffaf',
  '87ffd7',
  '87ffff',
  'af0000',
  'af005f',
  'af0087',
  'af00af',
  'af00d7',
  'af00ff',
  'af5f00',
  'af5f5f',
  'af5f87',
  'af5faf',
  'af5fd7',
  'af5fff',
  'af8700',
  'af875f',
  'af8787',
  'af87af',
  'af87d7',
  'af87ff',
  'afaf00',
  'afaf5f',
  'afaf87',
  'afafaf',
  'afafd7',
  'afafff',
  'afd700',
  'afd75f',
  'afd787',
  'afd7af',
  'afd7d7',
  'afd7ff',
  'afff00',
  'afff5f',
  'afff87',
  'afffaf',
  'afffd7',
  'afffff',
  'd70000',
  'd7005f',
  'd70087',
  'd700af',
  'd700d7',
  'd700ff',
  'd75f00',
  'd75f5f',
  'd75f87',
  'd75faf',
  'd75fd7',
  'd75fff',
  'd78700',
  'd7875f',
  'd78787',
  'd787af',
  'd787d7',
  'd787ff',
  'd7af00',
  'd7af5f',
  'd7af87',
  'd7afaf',
  'd7afd7',
  'd7afff',
  'd7d700',
  'd7d75f',
  'd7d787',
  'd7d7af',
  'd7d7d7',
  'd7d7ff',
  'd7ff00',
  'd7ff5f',
  'd7ff87',
  'd7ffaf',
  'd7ffd7',
  'd7ffff',
  'ff0000',
  'ff005f',
  'ff0087',
  'ff00af',
  'ff00d7',
  'ff00ff',
  'ff5f00',
  'ff5f5f',
  'ff5f87',
  'ff5faf',
  'ff5fd7',
  'ff5fff',
  'ff8700',
  'ff875f',
  'ff8787',
  'ff87af',
  'ff87d7',
  'ff87ff',
  'ffaf00',
  'ffaf5f',
  'ffaf87',
  'ffafaf',
  'ffafd7',
  'ffafff',
  'ffd700',
  'ffd75f',
  'ffd787',
  'ffd7af',
  'ffd7d7',
  'ffd7ff',
  'ffff00',
  'ffff5f',
  'ffff87',
  'ffffaf',
  'ffffd7',
  'ffffff',
  '080808',
  '121212',
  '1c1c1c',
  '262626',
  '303030',
  '3a3a3a',
  '444444',
  '4e4e4e',
  '585858',
  '606060',
  '666666',
  '767676',
  '808080',
  '8a8a8a',
  '949494',
  '9e9e9e',
  'a8a8a8',
  'b2b2b2',
  'bcbcbc',
  'c6c6c6',
  'd0d0d0',
  'dadada',
  'e4e4e4',
  'eeeeee'
]

// https://github.com/trapd00r/LS_COLORS/blob/master/LS_COLORS
;`
# documents {{{1
*README               38;5;220;1
*README.rst           38;5;220;1
*LICENSE              38;5;220;1
*COPYING              38;5;220;1
*INSTALL              38;5;220;1
*COPYRIGHT            38;5;220;1
*AUTHORS              38;5;220;1
*HISTORY              38;5;220;1
*CONTRIBUTORS         38;5;220;1
*PATENTS              38;5;220;1
*VERSION              38;5;220;1
*NOTICE               38;5;220;1
*CHANGES              38;5;220;1
.log                  38;5;190
# plain-text {{{2
.txt                  38;5;253
# markup {{{2
.etx                  38;5;184
.info                 38;5;184
.markdown             38;5;184
.md                   38;5;184
.mkd                  38;5;184
.nfo                  38;5;184
.pod                  38;5;184
.tex                  38;5;184
.textile              38;5;184
# key-value, non-relational data {{{2
.json                 38;5;178
.msg                  38;5;178
.pgn                  38;5;178
.rss                  38;5;178
.xml                  38;5;178
.yaml                 38;5;178
.yml                  38;5;178
.RData                38;5;178
.rdata                38;5;178
# }}}
# binary {{{2
.cbr                  38;5;141
.cbz                  38;5;141
.chm                  38;5;141
.djvu                 38;5;141
.pdf                  38;5;141
.PDF                  38;5;141
# words {{{3
.docm                 38;5;111;4
.doc                  38;5;111
.docx                 38;5;111
.eps                  38;5;111
.ps                   38;5;111
.odb                  38;5;111
.odt                  38;5;111
.rtf                  38;5;111
# presentation {{{3
.odp                  38;5;166
.pps                  38;5;166
.ppt                  38;5;166
.pptx                 38;5;166
#   Powerpoint show
.ppts                 38;5;166
#   Powerpoint with enabled macros
.pptxm                38;5;166;4
#   Powerpoint show with enabled macros
.pptsm                38;5;166;4
# spreadsheet {{{3
.csv                  38;5;78
#   Open document spreadsheet
.ods                  38;5;112
.xla                  38;5;76
#   Excel spreadsheet
.xls                  38;5;112
.xlsx                 38;5;112
#   Excel spreadsheet with macros
.xlsxm                38;5;112;4
#   Excel module
.xltm                 38;5;73;4
.xltx                 38;5;73
# }}}
# }}}
# configs {{{2
*cfg                  1
*conf                 1
*rc                   1
.ini                  1
.plist                1
#   vim
.viminfo              1
#   cisco VPN client configuration
.pcf                  1
#   adobe photoshop proof settings file
.psf                  1
# }}}
# }}}
# code {{{1
# version control {{{2
.git                  38;5;197
.gitignore            38;5;240
.gitattributes        38;5;240
.gitmodules           38;5;240

# shell {{{2
.awk                  38;5;172
.bash                 38;5;172
.bat                  38;5;172
.BAT                  38;5;172
.sed                  38;5;172
.sh                   38;5;172
.zsh                  38;5;172
.vim                  38;5;172

# interpreted {{{2
.ahk                  38;5;41
# python
.py                   38;5;41
# perl
.pl                   38;5;208
.PL                   38;5;160
.t                    38;5;114
# sql
.msql                 38;5;222
.mysql                38;5;222
.pgsql                38;5;222
.sql                  38;5;222
#   Tool Command Language
.tcl                  38;5;64;1
# R language
.r                    38;5;49
.R                    38;5;49
# GrADS script
.gs                   38;5;81

# compiled {{{2
#
#   assembly language
.asm                  38;5;81
#   LISP
.cl                   38;5;81
.lisp                 38;5;81
#   lua
.lua                  38;5;81
#   Moonscript
.moon                 38;5;81
#   C
.c                    38;5;81
.C                    38;5;81
.h                    38;5;110
.H                    38;5;110
.tcc                  38;5;110
#   C++
.c++                  38;5;81
.h++                  38;5;110
.hpp                  38;5;110
.hxx                  38;5;110
.ii                   38;5;110
#   method file for Objective C
.M                    38;5;110
.m                    38;5;110
#   Csharp
.cc                   38;5;81
.cs                   38;5;81
.cp                   38;5;81
.cpp                  38;5;81
.cxx                  38;5;81
#   Crystal
.cr                   38;5;81
#   Google golang
.go                   38;5;81
#   fortran
.f                    38;5;81
.for                  38;5;81
.ftn                  38;5;81
#   pascal
.s                    38;5;110
.S                    38;5;110
#   Rust
.rs                   38;5;81
#   Swift
.swift                38;5;219
#   ?
.sx                   38;5;81
#   interface file in GHC - https://github.com/trapd00r/LS_COLORS/pull/9
.hi                   38;5;110
#   haskell
.hs                   38;5;81
.lhs                  38;5;81

# binaries {{{2
# compiled apps for interpreted languages
.pyc                  38;5;240
# }}}
# html {{{2
.css                  38;5;125;1
.less                 38;5;125;1
.sass                 38;5;125;1
.scss                 38;5;125;1
.htm                  38;5;125;1
.html                 38;5;125;1
.jhtm                 38;5;125;1
.mht                  38;5;125;1
.eml                  38;5;125;1
.mustache             38;5;125;1
# }}}
# java {{{2
.coffee               38;5;074;1
.java                 38;5;074;1
.js                   38;5;074;1
.jsm                  38;5;074;1
.jsm                  38;5;074;1
.jsp                  38;5;074;1
# }}}
# php {{{2
.php                  38;5;81
#   CakePHP view scripts and helpers
.ctp                  38;5;81
#   Twig template engine
.twig                 38;5;81
# }}}
# vb/a {{{2
.vb                   38;5;81
.vba                  38;5;81
.vbs                  38;5;81
# 2}}}
# Build stuff {{{2
*Dockerfile           38;5;155
.dockerignore         38;5;240
*Makefile             38;5;155
*MANIFEST             38;5;243
*pm_to_blib           38;5;240
# automake
.am                   38;5;242
.in                   38;5;242
.hin                  38;5;242
.scan                 38;5;242
.m4                   38;5;242
.old                  38;5;242
.out                  38;5;242
.SKIP                 38;5;244
# }}}
# patch files {{{2
.diff                 48;5;197;38;5;232
.patch                48;5;197;38;5;232;1
#}}}
# graphics {{{1
.bmp                  38;5;97
.tiff                 38;5;97
.tif                  38;5;97
.TIFF                 38;5;97
.cdr                  38;5;97
.gif                  38;5;97
.ico                  38;5;97
.jpeg                 38;5;97
.JPG                  38;5;97
.jpg                  38;5;97
.nth                  38;5;97
.png                  38;5;97
.psd                  38;5;97
.xpm                  38;5;97
# }}}
# vector {{{1
.ai                   38;5;99
.eps                  38;5;99
.epsf                 38;5;99
.drw                  38;5;99
.ps                   38;5;99
.svg                  38;5;99
# }}}
# video {{{1
.avi                  38;5;114
.divx                 38;5;114
.IFO                  38;5;114
.m2v                  38;5;114
.m4v                  38;5;114
.mkv                  38;5;114
.MOV                  38;5;114
.mov                  38;5;114
.mp4                  38;5;114
.mpeg                 38;5;114
.mpg                  38;5;114
.ogm                  38;5;114
.rmvb                 38;5;114
.sample               38;5;114
.wmv                  38;5;114
  # mobile/streaming {{{2
.3g2                  38;5;115
.3gp                  38;5;115
.gp3                  38;5;115
.webm                 38;5;115
.gp4                  38;5;115
.asf                  38;5;115
.flv                  38;5;115
.ts                   38;5;115
.ogv                  38;5;115
.f4v                  38;5;115
  # }}}
  # lossless {{{2
.VOB                  38;5;115;1
.vob                  38;5;115;1
# }}}
# audio {{{1
.3ga                  38;5;137;1
.S3M                  38;5;137;1
.aac                  38;5;137;1
.au                   38;5;137;1
.dat                  38;5;137;1
.dts                  38;5;137;1
.fcm                  38;5;137;1
.m4a                  38;5;137;1
.mid                  38;5;137;1
.midi                 38;5;137;1
.mod                  38;5;137;1
.mp3                  38;5;137;1
.mp4a                 38;5;137;1
.oga                  38;5;137;1
.ogg                  38;5;137;1
.opus                 38;5;137;1
.s3m                  38;5;137;1
.sid                  38;5;137;1
.wma                  38;5;137;1
# lossless
.ape                  38;5;136;1
.aiff                 38;5;136;1
.cda                  38;5;136;1
.flac                 38;5;136;1
.alac                 38;5;136;1
.midi                 38;5;136;1
.pcm                  38;5;136;1
.wav                  38;5;136;1
.wv                   38;5;136;1
.wvc                  38;5;136;1

# }}}
# fonts {{{1
.afm                  38;5;66
.fon                  38;5;66
.fnt                  38;5;66
.pfb                  38;5;66
.pfm                  38;5;66
.ttf                  38;5;66
.otf                  38;5;66
#   postscript fonts
.PFA                  38;5;66
.pfa                  38;5;66
# }}}
# archives {{{1
.7z                   38;5;40
.a                    38;5;40
.arj                  38;5;40
.bz2                  38;5;40
.cpio                 38;5;40
.gz                   38;5;40
.lrz                  38;5;40
.lz                   38;5;40
.lzma                 38;5;40
.lzo                  38;5;40
.rar                  38;5;40
.s7z                  38;5;40
.sz                   38;5;40
.tar                  38;5;40
.tgz                  38;5;40
.xz                   38;5;40
.z                    38;5;40
.Z                    38;5;40
.zip                  38;5;40
.zipx                 38;5;40
.zoo                  38;5;40
.zpaq                 38;5;40
.zz                   38;5;40
  # packaged apps {{{2
.apk                  38;5;215
.deb                  38;5;215
.rpm                  38;5;215
.jad                  38;5;215
.jar                  38;5;215
.cab                  38;5;215
.pak                  38;5;215
.pk3                  38;5;215
.vdf                  38;5;215
.vpk                  38;5;215
.bsp                  38;5;215
.dmg                  38;5;215
  # }}}
  # segments from 0 to three digits after first extension letter {{{2
.r[0-9]{0,2}          38;5;239
.zx[0-9]{0,2}         38;5;239
.z[0-9]{0,2}          38;5;239
# partial files
.part                 38;5;239
  # }}}
# partition images {{{2
.dmg                  38;5;124
.iso                  38;5;124
.bin                  38;5;124
.nrg                  38;5;124
.qcow                 38;5;124
.sparseimage          38;5;124
.toast                38;5;124
.vcd                  38;5;124
.vmdk                 38;5;124
# }}}
# databases {{{2
.accdb                38;5;60
.accde                38;5;60
.accdr                38;5;60
.accdt                38;5;60
.db                   38;5;60
.fmp12                38;5;60
.fp7                  38;5;60
.localstorage         38;5;60
.mdb                  38;5;60
.mde                  38;5;60
.sqlite               38;5;60
.typelib              38;5;60
# NetCDF database
.nc                   38;5;60
# }}}
# tempfiles {{{1
# undo files
.pacnew               38;5;33
.un~                  38;5;241
.orig                 38;5;241
# backups
.BUP                  38;5;241
.bak                  38;5;241
.o                    38;5;241 #   *nix Object file (shared libraries, core dumps etc)
.rlib                 38;5;241 #   Static rust library
# temporary files
.swp                  38;5;244
.swo                  38;5;244
.tmp                  38;5;244
.sassc                38;5;244
# state files
.pid                  38;5;248
.state                38;5;248
*lockfile             38;5;248
# error logs
.err                  38;5;160;1
.error                38;5;160;1
.stderr               38;5;160;1
# state dumps
.dump                 38;5;241
.stackdump            38;5;241
.zcompdump            38;5;241
.zwc                  38;5;241
# tcpdump, network traffic capture
.pcap                 38;5;29
.cap                  38;5;29
.dmp                  38;5;29
# macOS
.DS_Store             38;5;239
.localized            38;5;239
.CFUserTextEncoding   38;5;239
# }}}
# hosts {{{1
# /etc/hosts.{deny,allow}
.allow                38;5;112
.deny                 38;5;196
# }}}
# systemd {{{1
# http://www.freedesktop.org/software/systemd/man/systemd.unit.html
.service              38;5;45
*@.service            38;5;45
.socket               38;5;45
.swap                 38;5;45
.device               38;5;45
.mount                38;5;45
.automount            38;5;45
.target               38;5;45
.path                 38;5;45
.timer                38;5;45
.snapshot             38;5;45
# }}}
# metadata {{{1
.application          38;5;116
.cue                  38;5;116
.description          38;5;116
.directory            38;5;116
.m3u                  38;5;116
.m3u8                 38;5;116
.md5                  38;5;116
.properties           38;5;116
.sfv                  38;5;116
.srt                  38;5;116
.theme                38;5;116
.torrent              38;5;116
.urlview              38;5;116
# }}}
# encrypted data {{{1
.asc                  38;5;192;3
.bfe                  38;5;192;3
.enc                  38;5;192;3
.gpg                  38;5;192;3
.signature            38;5;192;3
.sig                  38;5;192;3
.p12                  38;5;192;3
.pem                  38;5;192;3
.pgp                  38;5;192;3
.asc                  38;5;192;3
.enc                  38;5;192;3
.sig                  38;5;192;3
# 1}}}
# emulators {{{1
.32x                  38;5;213
.cdi                  38;5;213
.fm2                  38;5;213
.rom                  38;5;213
.sav                  38;5;213
.st                   38;5;213
  # atari
.a00                  38;5;213
.a52                  38;5;213
.A64                  38;5;213
.a64                  38;5;213
.a78                  38;5;213
.adf                  38;5;213
.atr                  38;5;213
  # nintendo
.gb                   38;5;213
.gba                  38;5;213
.gbc                  38;5;213
.gel                  38;5;213
.gg                   38;5;213
.ggl                  38;5;213
.ipk                  38;5;213 # Nintendo (DS Packed Images)
.j64                  38;5;213
.nds                  38;5;213
.nes                  38;5;213
  # Sega
.sms                  38;5;213
# }}}
# unsorted {{{1
#
#   Portable Object Translation for GNU Gettext
.pot                  38;5;7
#   CAD files for printed circuit boards
.pcb                  38;5;7
#   groff (rendering app for texinfo)
.mm                   38;5;7
#   perldoc
.pod                  38;5;7
#   GIMP brush
.gbr                  38;5;7
# printer spool file
.spl                  38;5;7
#   GIMP project file
.scm                  38;5;7
# RStudio project file
.Rproj                38;5;11
#   Nokia Symbian OS files
.sis                  38;5;7

.1p                   38;5;7
.3p                   38;5;7
.cnc                  38;5;7
.def                  38;5;7
.ex                   38;5;7
.example              38;5;7
.feature              38;5;7
.ger                  38;5;7
.map                  38;5;7
.mf                   38;5;7
.mfasl                38;5;7
.mi                   38;5;7
.mtx                  38;5;7
.pc                   38;5;7
.pi                   38;5;7
.plt                  38;5;7
.pm                   38;5;7
.rb                   38;5;7
.rdf                  38;5;7
.rst                  38;5;7
.ru                   38;5;7
.sch                  38;5;7
.sty                  38;5;7
.sug                  38;5;7
.t                    38;5;7
.tdy                  38;5;7
.tfm                  38;5;7
.tfnt                 38;5;7
.tg                   38;5;7
.vcard                38;5;7
.vcf                  38;5;7
.xln                  38;5;7
#   AppCode files
.iml                  38;5;166
#   Xcode files
.xcconfig             1
.entitlements         1
.strings              1
.storyboard           38;5;196
.xcsettings           1
.xib                  38;5;208
`
  .split('\n')
  .forEach(line => {
    if (line.trim() === '') return
    if (line.startsWith('#')) {
      description.push(line)
      return
    }
    const m = color_reg.exec(line)
    if (m && m.length >= 2) {
      const key = m[1]
      const val = m[2].split(';')[2] || m[2][0]

      console.log('line: ', line)
      console.log(key, '->', val)

      all_types.add(key)
      color_types.add(val)

      extension_map[key] = '#' + xterm_colors[val]
    }
  })

console.log('all_types', all_types.size, 'color_types', color_types.size)

console.log(extension_map)
