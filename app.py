import os
import threading
import webbrowser
from datetime import datetime

from flask import Flask, jsonify, render_template, request

import db

app = Flask(__name__)

VALID_STATUS = {"已投递", "笔试", "面试", "offer", "已拒", "搁置"}


def now_str():
    return datetime.now().isoformat(timespec="seconds")


def clean(data, field):
    return str(data.get(field) or "").strip()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/applications")
def list_applications():
    return jsonify(db.list_applications())


@app.post("/api/applications")
def create_application():
    data = request.get_json(force=True, silent=True) or {}
    company = clean(data, "company")
    position = clean(data, "position")
    if not company or not position:
        return jsonify({"error": "公司和岗位为必填项"}), 400
    status = clean(data, "status") or "已投递"
    if status not in VALID_STATUS:
        return jsonify({"error": "非法状态"}), 400
    ts = now_str()
    cur = db.execute(
        """INSERT INTO applications
           (company, position, city, channel, applied_date, status, link, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (company, position, clean(data, "city"), clean(data, "channel"),
         clean(data, "applied_date"), status, clean(data, "link"),
         clean(data, "notes"), ts, ts),
    )
    return jsonify({"id": cur.lastrowid}), 201


@app.put("/api/applications/<int:app_id>")
def update_application(app_id):
    data = request.get_json(force=True, silent=True) or {}
    company = clean(data, "company")
    position = clean(data, "position")
    if not company or not position:
        return jsonify({"error": "公司和岗位为必填项"}), 400
    status = clean(data, "status")
    if status not in VALID_STATUS:
        return jsonify({"error": "非法状态"}), 400
    cur = db.execute(
        """UPDATE applications
           SET company=?, position=?, city=?, channel=?, applied_date=?,
               status=?, link=?, notes=?, updated_at=?
           WHERE id=?""",
        (company, position, clean(data, "city"), clean(data, "channel"),
         clean(data, "applied_date"), status, clean(data, "link"),
         clean(data, "notes"), now_str(), app_id),
    )
    if cur.rowcount == 0:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"ok": True})


@app.delete("/api/applications/<int:app_id>")
def delete_application(app_id):
    cur = db.execute("DELETE FROM applications WHERE id=?", (app_id,))
    if cur.rowcount == 0:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"ok": True})


@app.post("/api/applications/<int:app_id>/events")
def create_event(app_id):
    data = request.get_json(force=True, silent=True) or {}
    etype = clean(data, "type")
    etime = clean(data, "event_time")
    if not etype or not etime:
        return jsonify({"error": "进展类型和时间必填"}), 400
    if not db.query("SELECT id FROM applications WHERE id=?", (app_id,)):
        return jsonify({"error": "记录不存在"}), 404
    cur = db.execute(
        "INSERT INTO events (application_id, type, event_time, notes, created_at) VALUES (?, ?, ?, ?, ?)",
        (app_id, etype, etime, clean(data, "notes"), now_str()),
    )
    db.execute("UPDATE applications SET updated_at=? WHERE id=?", (now_str(), app_id))
    return jsonify({"id": cur.lastrowid}), 201


@app.put("/api/events/<int:event_id>")
def update_event(event_id):
    data = request.get_json(force=True, silent=True) or {}
    etype = clean(data, "type")
    etime = clean(data, "event_time")
    if not etype or not etime:
        return jsonify({"error": "进展类型和时间必填"}), 400
    cur = db.execute(
        "UPDATE events SET type=?, event_time=?, notes=? WHERE id=?",
        (etype, etime, clean(data, "notes"), event_id),
    )
    if cur.rowcount == 0:
        return jsonify({"error": "进展不存在"}), 404
    return jsonify({"ok": True})


@app.delete("/api/events/<int:event_id>")
def delete_event(event_id):
    cur = db.execute("DELETE FROM events WHERE id=?", (event_id,))
    if cur.rowcount == 0:
        return jsonify({"error": "进展不存在"}), 404
    return jsonify({"ok": True})


def open_browser(port):
    webbrowser.open(f"http://127.0.0.1:{port}")


if __name__ == "__main__":
    db.init_db()
    port = int(os.environ.get("PORT", "8765"))
    threading.Timer(1.0, open_browser, args=(port,)).start()
    print(f"秋招投递记录系统运行中：http://127.0.0.1:{port} （关闭本窗口即停止）")
    try:
        app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
    except OSError:
        print(f"端口 {port} 被占用。请关闭占用程序，或用 PORT 环境变量换个端口（如 PORT=9000）。")
