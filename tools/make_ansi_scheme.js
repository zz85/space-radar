const color_reg = /([^ ]+)\W+([\d;]+)/

const extension_map = {}
const types = new Set()

const SOLARIZED_NAMES = {
  base03: { r: '0', g: '43', b: '54' },
  base02: { r: '7', g: '54', b: '66' },
  base01: { r: '88', g: '110', b: '117' },
  base00: { r: '101', g: '123', b: '131' },
  base0: { r: '131', g: '148', b: '150' },
  base1: { r: '147', g: '161', b: '161' },
  base2: { r: '238', g: '232', b: '213' },
  base3: { r: '253', g: '246', b: '227' },
  yellow: { r: '181', g: '137', b: '0' },
  orange: { r: '203', g: '75', b: '22' },
  red: { r: '220', g: '50', b: '47' },
  magenta: { r: '211', g: '54', b: '130' },
  violet: { r: '108', g: '113', b: '196' },
  blue: { r: '38', g: '139', b: '210' },
  cyan: { r: '42', g: '161', b: '152' },
  green: { r: '133', g: '153', b: '0' }
}

const CODES = {
  30: SOLARIZED_NAMES['base02'],
  31: SOLARIZED_NAMES['red'],
  32: SOLARIZED_NAMES['green'],
  33: SOLARIZED_NAMES['yellow'],
  34: SOLARIZED_NAMES['blue'],
  35: SOLARIZED_NAMES['magenta'],
  36: SOLARIZED_NAMES['cyan'],
  37: SOLARIZED_NAMES['base2']
}

/*
#   ANSI Color code       Solarized  Notes                Universal             SolDark              SolLight
#   ~~~~~~~~~~~~~~~       ~~~~~~~~~  ~~~~~                ~~~~~~~~~             ~~~~~~~              ~~~~~~~~
#   00    none                                            NORMAL, FILE          <SAME>               <SAME>
#   30    black           base02
#   01;30 bright black    base03     bg of SolDark
#   31    red             red                             docs & mm src         <SAME>               <SAME>
#   01;31 bright red      orange                          EXEC                  <SAME>               <SAME>
#   32    green           green                           editable text         <SAME>               <SAME>
#   01;32 bright green    base01                          unimportant text      <SAME>
#   33    yellow          yellow     unclear in light bg  multimedia            <SAME>               <SAME>
#   01;33 bright yellow   base00     fg of SolLight                             unimportant non-text
#   34    blue            blue       unclear in dark bg   user customized       <SAME>               <SAME>
#   01;34 bright blue     base0      fg in SolDark                                                   unimportant text
#   35    magenta         magenta                         LINK                  <SAME>               <SAME>
#   01;35 bright magenta  violet                          archive/compressed    <SAME>               <SAME>
#   36    cyan            cyan                            DIR                   <SAME>               <SAME>
#   01;36 bright cyan     base1                           unimportant non-text                       <SAME>
#   37    white           base2
#   01;37 bright white    base3      bg in SolLight
#   05;37;41                         unclear in Putty dark
*/

// https://github.com/seebi/dircolors-solarized/blob/master/dircolors.ansi-light
const ANSI_LIGHT = `
### By extension

# List any file extensions like '.gz' or '.tar' that you would like ls
# to colorize below. Put the extension, a space, and the color init string.
# (and any comments you want to add after a '#')

### Text formats

# Text that we can edit with a regular editor
.txt 32
.org 32
.md 32
.mkd 32

# Source text
.h 32
.hpp 32
.c 32
.C 32
.cc 32
.cpp 32
.cxx 32
.objc 32
.cl 32
.sh 32
.bash 32
.csh 32
.zsh 32
.el 32
.vim 32
.java 32
.pl 32
.pm 32
.py 32
.rb 32
.hs 32
.php 32
.htm 32
.html 32
.shtml 32
.erb 32
.haml 32
.xml 32
.rdf 32
.css 32
.sass 32
.scss 32
.less 32
.js 32
.coffee 32
.man 32
.0 32
.1 32
.2 32
.3 32
.4 32
.5 32
.6 32
.7 32
.8 32
.9 32
.l 32
.n 32
.p 32
.pod 32
.tex 32
.go 32
.sql 32
.csv 32
.sv 32
.svh 32
.v 32
.vh 32
.vhd 32

### Multimedia formats

# Image
.bmp 33
.cgm 33
.dl 33
.dvi 33
.emf 33
.eps 33
.gif 33
.jpeg 33
.jpg 33
.JPG 33
.mng 33
.pbm 33
.pcx 33
.pdf 33
.pgm 33
.png 33
.PNG 33
.ppm 33
.pps 33
.ppsx 33
.ps 33
.svg 33
.svgz 33
.tga 33
.tif 33
.tiff 33
.xbm 33
.xcf 33
.xpm 33
.xwd 33
.xwd 33
.yuv 33

# Audio
.aac 33
.au  33
.flac 33
.m4a 33
.mid 33
.midi 33
.mka 33
.mp3 33
.mpa 33
.mpeg 33
.mpg 33
.ogg  33
.opus 33
.ra 33
.wav 33

# Video
.anx 33
.asf 33
.avi 33
.axv 33
.flc 33
.fli 33
.flv 33
.gl 33
.m2v 33
.m4v 33
.mkv 33
.mov 33
.MOV 33
.mp4 33
.mp4v 33
.mpeg 33
.mpg 33
.nuv 33
.ogm 33
.ogv 33
.ogx 33
.qt 33
.rm 33
.rmvb 33
.swf 33
.vob 33
.webm 33
.wmv 33

### Misc

# Binary document formats and multimedia source
.doc 31
.docx 31
.rtf 31
.odt 31
.dot 31
.dotx 31
.ott 31
.xls 31
.xlsx 31
.ods 31
.ots 31
.ppt 31
.pptx 31
.odp 31
.otp 31
.fla 31
.psd 31

# Archives, compressed
.7z   1;35
.apk  1;35
.arj  1;35
.bin  1;35
.bz   1;35
.bz2  1;35
.cab  1;35  # Win
.deb  1;35
.dmg  1;35  # OSX
.gem  1;35
.gz   1;35
.iso  1;35
.jar  1;35
.msi  1;35  # Win
.rar  1;35
.rpm  1;35
.tar  1;35
.tbz  1;35
.tbz2 1;35
.tgz  1;35
.tx   1;35
.war  1;35
.xpi  1;35
.xz   1;35
.z    1;35
.Z    1;35
.zip  1;35

# For testing
.ANSI-30-black 30
.ANSI-01;30-brblack 01;30
.ANSI-31-red 31
.ANSI-01;31-brred 01;31
.ANSI-32-green 32
.ANSI-01;32-brgreen 01;32
.ANSI-33-yellow 33
.ANSI-01;33-bryellow 01;33
.ANSI-34-blue 34
.ANSI-01;34-brblue 01;34
.ANSI-35-magenta 35
.ANSI-01;35-brmagenta 01;35
.ANSI-36-cyan 36
.ANSI-01;36-brcyan 01;36
.ANSI-37-white 37
.ANSI-01;37-brwhite 01;37

#############################################################################
# Your customizations

# Unimportant text files
# For universal scheme, use brightgreen 01;32
# For optimal on light bg (but too prominent on dark bg), use white 01;34
.log 01;32
*~ 01;32
*# 01;32
#.log 01;34
#*~ 01;34
#*# 01;34

# Unimportant non-text files
# For universal scheme, use brightcyan 01;36
# For optimal on dark bg (but too prominent on light bg), change to 01;33
#.bak 01;36
#.BAK 01;36
#.old 01;36
#.OLD 01;36
#.org_archive 01;36
#.off 01;36
#.OFF 01;36
#.dist 01;36
#.DIST 01;36
#.orig 01;36
#.ORIG 01;36
#.swp 01;36
#.swo 01;36
#*,v 01;36
.bak 01;33
.BAK 01;33
.old 01;33
.OLD 01;33
.org_archive 01;33
.off 01;33
.OFF 01;33
.dist 01;33
.DIST 01;33
.orig 01;33
.ORIG 01;33
.swp 01;33
.swo 01;33
*,v 01;33

# The brightmagenta (Solarized: purple) color is free for you to use for your
# custom file type
.gpg 34
.gpg 34
.pgp 34
.asc 34
.3des 34
.aes 34
.enc 34
.sqlite 34
`
  .split('\n')
  .forEach(line => {
    if (line.trim() === '') return
    if (line.startsWith('#')) return
    const m = color_reg.exec(line)
    if (m && m.length >= 2) {
      const key = m[1]
      const val = /(\d+)$/.exec(m[2])[1]
      console.log(key, '->', val)
      console.log('line: ', line)

      types.add(val)

      extension_map[key] = CODES[val]
    }
  })

console.log(types)
console.log('----------------------')
console.log(extension_map)
