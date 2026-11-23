import logging
import re
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from database import db_session, dict_from_row
from api_utils import (
    MAX_GEMINI_TEXT_LENGTH,
    is_positive_int,
    json_object_payload,
    validate_id_field,
    validate_query_id,
    validate_required_fields,
    validate_string_fields,
)

logger = logging.getLogger(__name__)

content_bp = Blueprint("content", __name__, url_prefix="/api/content")

ALLOWED_EXTENSIONS = {"txt", "md", "markdown", "docx", "pdf", "json", "csv"}

def allowed_file(filename):
    return (
        isinstance(filename, str)
        and "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )

def extract_text_from_file(file_storage, filename):
    ext = filename.rsplit(".", 1)[1].lower()
    
    if ext in ("txt", "md", "markdown", "json", "csv"):
        try:
            return file_storage.read().decode("utf-8")
        except UnicodeDecodeError:
            file_storage.seek(0)
            return file_storage.read().decode("latin-1")

    elif ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_storage)
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            raise ValueError("Could not read PDF file") from e

    elif ext == "docx":
        try:
            import docx
            doc = docx.Document(file_storage)
            return "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception as e:
            raise ValueError("Could not read DOCX file") from e

    raise ValueError(f"Unsupported file format: {ext}")

@content_bp.route("/upload", methods=["POST"])
def upload_document():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected"}), 400
    if len(file.filename) > 255:
        return jsonify({"success": False, "error": "Filename must be 255 characters or fewer"}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": f"File type not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    filename = secure_filename(file.filename)
    try:
        extracted_text = extract_text_from_file(file, filename)
        if len(extracted_text) > MAX_GEMINI_TEXT_LENGTH:
            return jsonify({
                "success": False,
                "error": f"Extracted text exceeds the {MAX_GEMINI_TEXT_LENGTH}-character limit",
            }), 413
        return jsonify({
            "success": True,
            "filename": filename,
            "text": extracted_text,
            "character_count": len(extracted_text),
            "word_count": len(extracted_text.split())
        })
    except Exception as error:
        logger.error(
            "Upload error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({"success": False, "error": "Could not read the uploaded file."}), 400

@content_bp.route("", methods=["GET"])
def list_content():
    brand_id = validate_query_id("brand_id")
    status = request.args.get("status")
    channel = request.args.get("channel")
    if status is not None and status not in {
        "draft", "pending_review", "approved", "rejected", "changes_requested"
    }:
        return jsonify({"success": False, "error": "Invalid content status"}), 400
    if channel is not None and len(channel) > 200:
        return jsonify({"success": False, "error": "channel must be 200 characters or fewer"}), 400

    query = """
        SELECT c.*, b.name as brand_name 
        FROM content_items c
        JOIN brands b ON c.brand_id = b.id
        WHERE 1=1
    """
    params = []

    if brand_id is not None:
        query += " AND c.brand_id = ?"
        params.append(brand_id)
    if status:
        query += " AND c.status = ?"
        params.append(status)
    if channel:
        query += " AND c.channel = ?"
        params.append(channel)

    query += " ORDER BY c.updated_at DESC"

    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            items = [dict_from_row(r) for r in cursor.fetchall()]
        return jsonify({"success": True, "items": items})
    except Exception as error:
        logger.error(
            "List content error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({"success": False, "error": "Could not retrieve content."}), 500

@content_bp.route("/<int:content_id>", methods=["GET"])
def get_content_detail(content_id):
    if not is_positive_int(content_id):
        return jsonify({"success": False, "error": "Content item not found"}), 404
    requested_brand_id = validate_query_id("brand_id")
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            query = """
                SELECT c.*, b.name as brand_name, b.primary_tone, b.tagline
                FROM content_items c
                JOIN brands b ON c.brand_id = b.id
                WHERE c.id = ?
            """
            params = [content_id]
            if requested_brand_id is not None:
                query += " AND c.brand_id = ?"
                params.append(requested_brand_id)
            cursor.execute(query, params)
            item = cursor.fetchone()
            if not item:
                return jsonify({"success": False, "error": "Content item not found"}), 404

            item_dict = dict_from_row(item)

            # Fetch latest analysis
            cursor.execute("""
                SELECT * FROM analysis_results 
                WHERE content_id = ? 
                ORDER BY id DESC LIMIT 1
            """, (content_id,))
            analysis_row = cursor.fetchone()
            analysis = dict_from_row(analysis_row) if analysis_row else None

            if analysis:
                import json
                for k in ["sub_scores", "issues", "readability"]:
                    if analysis.get(k) and isinstance(analysis[k], str):
                        try:
                            analysis[k] = json.loads(analysis[k])
                        except:
                            pass

            # Fetch version history
            cursor.execute("""
                SELECT * FROM content_versions 
                WHERE content_id = ? 
                ORDER BY version_number DESC
            """, (content_id,))
            versions = [dict_from_row(r) for r in cursor.fetchall()]

            # Fetch review history
            cursor.execute("""
                SELECT * FROM reviews 
                WHERE content_id = ? 
                ORDER BY id DESC
            """, (content_id,))
            reviews = [dict_from_row(r) for r in cursor.fetchall()]

        return jsonify({
            "success": True,
            "content": item_dict,
            "latest_analysis": analysis,
            "versions": versions,
            "reviews": reviews
        })
    except Exception as error:
        logger.error(
            "Get content detail error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({"success": False, "error": "Could not retrieve content details."}), 500


@content_bp.route("/<content_id>/restore", methods=["POST"])
def restore_content_version(content_id):
    if (
        len(content_id) > 19
        or not re.fullmatch(r"[0-9]+", content_id)
        or not is_positive_int(int(content_id))
    ):
        return jsonify({"success": False, "error": "A valid content ID is required."}), 400
    content_id = int(content_id)

    data = json_object_payload()
    validate_required_fields(
        data,
        ("brand_id", "version_id", "expected_current_version"),
    )
    brand_id = validate_id_field(data, "brand_id", required=True)
    version_id = validate_id_field(data, "version_id", required=True)
    expected_current_version = validate_id_field(
        data,
        "expected_current_version",
        required=True,
    )

    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT current_version
                FROM content_items
                WHERE id = ? AND brand_id = ?
                """,
                (content_id, brand_id),
            )
            content = cursor.fetchone()
            if not content:
                return jsonify({"success": False, "error": "Content item not found."}), 404

            current_version = content["current_version"]
            if current_version != expected_current_version:
                return jsonify({
                    "success": False,
                    "error": "Content changed before the restore completed. Reload the latest version.",
                    "current_version": current_version,
                }), 409

            cursor.execute(
                """
                SELECT id, version_number, text
                FROM content_versions
                WHERE id = ? AND content_id = ?
                """,
                (version_id, content_id),
            )
            source_version = cursor.fetchone()
            if not source_version:
                return jsonify({
                    "success": False,
                    "error": "Selected version was not found for this content.",
                }), 404
            if source_version["version_number"] == current_version:
                return jsonify({
                    "success": False,
                    "error": "The selected version is already current.",
                    "current_version": current_version,
                }), 409

            new_version = current_version + 1
            cursor.execute(
                """
                UPDATE content_items
                SET original_text = ?,
                    corrected_text = NULL,
                    current_version = ?,
                    status = 'draft',
                    risk_score = NULL,
                    risk_level = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND brand_id = ? AND current_version = ?
                """,
                (
                    source_version["text"],
                    new_version,
                    content_id,
                    brand_id,
                    expected_current_version,
                ),
            )
            if cursor.rowcount != 1:
                return jsonify({
                    "success": False,
                    "error": "Content changed before the restore completed. Reload the latest version.",
                }), 409

            cursor.execute(
                """
                INSERT INTO content_versions (
                    content_id, version_number, text, corrected_text,
                    risk_score, risk_level
                )
                VALUES (?, ?, ?, NULL, NULL, NULL)
                """,
                (content_id, new_version, source_version["text"]),
            )
            restored_version_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "content_id": content_id,
            "brand_id": brand_id,
            "restored_from_version_id": version_id,
            "version_id": restored_version_id,
            "version": new_version,
            "status": "draft",
            "message": (
                f"Version {source_version['version_number']} was restored as "
                f"new version {new_version}. Existing versions and reviews were preserved."
            ),
        })
    except Exception as error:
        logger.error(
            "Restore content version error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({
            "success": False,
            "error": "Could not restore the selected content version.",
        }), 500


@content_bp.route("", methods=["POST"])
def create_content():
    data = json_object_payload()
    validate_string_fields(
        data,
        ("title", "content_type", "channel", "text"),
        max_lengths={
            "title": 250,
            "content_type": 100,
            "channel": 200,
            "text": MAX_GEMINI_TEXT_LENGTH,
        },
    )
    validate_required_fields(data, ("brand_id", "text"))
    brand_id = data.get("brand_id")
    title = data.get("title", "")
    text = data.get("text", "")

    if not is_positive_int(brand_id):
        return jsonify({"success": False, "error": "A valid brand_id is required"}), 400
    title = title.strip() if isinstance(title, str) else ""
    content_type = data.get("content_type") or "Ad Copy"
    channel = data.get("channel") or "Digital Ads"
    if not text.strip():
        return jsonify({"success": False, "error": "Content text is required"}), 400

    try:
        with db_session() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO content_items (brand_id, title, content_type, channel, original_text, current_version, status)
                VALUES (?, ?, ?, ?, ?, 1, 'draft')
            """, (brand_id, title or "Untitled Draft", content_type, channel, text))
            content_id = cursor.lastrowid

            # Create version 1 record
            cursor.execute("""
                INSERT INTO content_versions (content_id, version_number, text)
                VALUES (?, 1, ?)
            """, (content_id, text))

        return jsonify({
            "success": True, 
            "content_id": content_id,
            "message": "Content created successfully"
        })
    except Exception as error:
        logger.error(
            "Create content error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({"success": False, "error": "Could not create content."}), 500


@content_bp.route("/<int:content_id>", methods=["DELETE"])
def delete_content(content_id):
    if not is_positive_int(content_id):
        return jsonify({"success": False, "error": "Content item not found"}), 404

    requested_brand_id = validate_query_id("brand_id", required=True)
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT brand_id FROM content_items WHERE id = ?",
                (content_id,),
            )
            content = cursor.fetchone()
            if not content or content["brand_id"] != requested_brand_id:
                return jsonify({"success": False, "error": "Content item not found"}), 404

            cursor.execute(
                "DELETE FROM content_items WHERE id = ?",
                (content_id,),
            )
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Content item not found"}), 404
        return jsonify({
            "success": True,
            "content_id": content_id,
            "message": "Content and associated history deleted.",
        })
    except Exception as error:
        logger.error(
            "Delete content error (exception_category=%s)",
            type(error).__name__,
        )
        return jsonify({"success": False, "error": "Could not delete the content item."}), 500
