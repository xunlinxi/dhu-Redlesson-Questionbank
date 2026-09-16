from pathlib import Path
p=Path('platforms/web/frontend/index.html');s=p.read_text(encoding='utf-8')
s=s.replace('width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no','width=device-width, initial-scale=1.0, viewport-fit=cover')
s=s.replace('<link rel="stylesheet" href="css/mobile.css">','<link rel="stylesheet" href="css/mobile.css">\n    <link rel="stylesheet" href="css/cosmic.css">\n    <meta name="theme-color" content="#091c29">')
a=s.index('                <section class="hero-section">');b=s.index('                <section class="stats-strip',a)
s=s[:a]+'''                <section class="hero-section" aria-labelledby="hero-heading">
                    <div class="hero-copy">
                        <div class="hero-eyebrow">DHU / KNOWLEDGE EXPLORATION</div>
                        <h1 class="hero-title" id="hero-heading">让每一次练习<em>都有回响。</em></h1>
                        <p class="hero-subtitle">从一道题开始，点亮你的知识宇宙。<br>习概 · 毛概 · 思修 · 近代史 · 马原，一站练习与复盘。</p>
                        <div class="hero-actions">
                            <button class="btn btn-primary" onclick="switchPage('practice')">开始刷题 <span aria-hidden="true">↗</span></button>
                            <button class="btn btn-glass" onclick="switchPage('import')">导入题库 <span aria-hidden="true">＋</span></button>
                        </div>
                        <div class="hero-footnote"><span></span>每一小步，都离掌握更近一点</div>
                    </div>
                    <div class="lunar-stage" aria-hidden="true">
                        <div class="lunar-orbit"></div><div class="lunar-disc"></div>
                        <div class="stage-cross">✧</div><div class="orbit-caption">EXPLORE · PRACTICE · GROW</div>
                        <div class="study-ticket"><small>YOUR NEXT CHAPTER</small><strong>今天，也进步一点。</strong><span class="ticket-number">01</span></div>
                    </div>
                </section>
                <div class="section-kicker">YOUR KNOWLEDGE AT A GLANCE / 学习概览</div>

'''+s[b:]
s=s.replace('上传 TXT/DOC 文件','TXT / DOCX，本地解析与导入')
s=s.replace('<div class="upload-area" id="upload-area">','<div class="import-steps"><span><b>01</b>选择文件</span><span><b>02</b>填写题库名</span><span><b>03</b>导入并查看结果</span></div>\n                    <div class="upload-area" id="upload-area" role="button" tabindex="0" aria-label="选择题库文件">')
s=s.replace('推荐使用TXT格式避免Word自动编号问题','支持 UTF-8 / GBK / UTF-16；离线端请将 DOC 另存为 DOCX。单文件不超过 20 MB。同名导入会替换原题库。')
s=s.replace('<button class="gnav-menu-btn" id="gnavMenuBtn"', '<button aria-label="打开导航菜单" class="gnav-menu-btn" id="gnavMenuBtn"')
s=s.replace('<a class="nav-link', '<a role="button" tabindex="0" class="nav-link')
p.write_text(s,encoding='utf-8')
# Remove explicit zoom blockers, keep platform detection in common source.
p=Path('platforms/web/frontend/js/mobile.js');s=p.read_text(encoding='utf-8');a=s.index('// 禁止双指缩放');b=s.index('function initMobile',a);s=s[:a]+s[b:];s=s.replace("if (window.electronAPI !== undefined)","if (window.electronAPI !== undefined || window.STATIC_MODE || window.Capacitor)");p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/js/app.js');s=p.read_text(encoding='utf-8');s=s.replace('    initUpload();', '''    initUpload();
    document.querySelectorAll('[role="button"]').forEach(element => {
        element.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); element.click(); }
        });
    });''',1);p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/js/modules/parser.js');s=p.read_text(encoding='utf-8').replace("([^\\n])([0-9]", "([^\\d\\n])([0-9]").replace("/^\\d+[.、．)）]\\s*/", "/^\\d+\\s*[.、．)）]\\s*/");p.write_text(s,encoding='utf-8')
