"""Isolated local UI test server; does not read/write the user's study records."""
import sys, tempfile, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'platforms/web'))
from backend import config
from backend.app import app
with tempfile.TemporaryDirectory(prefix='quiz-ui-') as directory:
    config.CONFIG_FILE=str(Path(directory)/'config.json')
    Path(config.CONFIG_FILE).write_text(json.dumps({'data_path':directory}),encoding='utf8')
    from flask import send_from_directory
    @app.route('/static-test/<path:name>')
    def static_test(name):
        return send_from_directory(ROOT/'platforms/web/static-site',name)
    @app.route('/android-test/<path:name>')
    def android_test(name):
        return send_from_directory(ROOT/'platforms/android/frontend',name)
    app.run(port=50123,host='127.0.0.1',threaded=True,use_reloader=False)
