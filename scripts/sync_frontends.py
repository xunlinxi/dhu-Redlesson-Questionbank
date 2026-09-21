"""Sync tracked runtime sources; never edit Capacitor generated assets directly.
Run with --check in CI to detect drift without writing files.
"""
import argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'platforms/web/frontend'
COMMON = ['index.html', 'css/style.css', 'css/mobile.css', 'css/cosmic.css', 'css/editorial.css',
          'js/app.js', 'js/mobile.js', 'js/modules/parser.js', 'js/modules/storage.js',
          'js/lib/dexie.min.js', 'js/lib/mammoth.browser.min.js']
STATIC_SCRIPTS = '''    <script src="js/lib/mammoth.browser.min.js"></script>
    <script src="js/modules/parser.js"></script>
    <script src="js/storage.js"></script>
    <script src="js/questions.js"></script>
    <script src="js/rankings.js"></script>
    <script src="js/wrongbook.js"></script>
    <script src="js/progress.js"></script>
    <script src="js/static-adapter.js"></script>'''


def outputs():
    for folder in ['vendor', 'img/illustrations']:
        for source in (SOURCE / folder).rglob('*'):
            if source.is_file():
                for destination in ['platforms/android/frontend', 'platforms/electron/frontend', 'platforms/web/static-site']:
                    yield ROOT / destination / source.relative_to(SOURCE), source.read_bytes()

    for platform in ['android', 'electron']:
        for relative in COMMON:
            yield ROOT / f'platforms/{platform}/frontend' / relative, (SOURCE / relative).read_bytes()
    for relative in ['css/style.css', 'css/mobile.css', 'css/cosmic.css', 'css/editorial.css', 'js/app.js', 'js/mobile.js', 'js/modules/parser.js', 'js/lib/mammoth.browser.min.js']:
        yield ROOT / 'platforms/web/static-site' / relative, (SOURCE / relative).read_bytes()
    html = (SOURCE / 'index.html').read_text(encoding='utf-8')
    start = html.index('    <script src="js/lib/mammoth')
    end = html.index('    <script src="js/app.js">', start)
    yield ROOT / 'platforms/web/static-site/index.html', (html[:start] + STATIC_SCRIPTS + '\n' + html[end:]).encode('utf-8')
    yield ROOT / 'platforms/electron/backend_parser.py', (ROOT / 'platforms/web/backend/parser.py').read_bytes()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    drift = []
    for target, content in outputs():
        if not target.exists() or target.read_bytes() != content:
            drift.append(str(target.relative_to(ROOT)))
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
    if args.check and drift:
        raise SystemExit('Out of sync:\n' + '\n'.join(drift))
    print(f'{len(drift)} files ' + ('out of sync' if args.check else 'synchronized'))

if __name__ == '__main__':
    main()
