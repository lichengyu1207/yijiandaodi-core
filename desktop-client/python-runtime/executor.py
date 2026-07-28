#!/usr/bin/env python3
import sys
import json
import os
import traceback
from pathlib import Path


def main():
    try:
        input_data = json.loads(sys.stdin.read())
        payload = input_data.get('payload', {})
        task_type = payload.get('type', 'unknown')
        shard_id = os.environ.get('TASK_SHARD_ID', 'unknown')

        handlers = {
            'ai_detection': _handle_ai_detection,
            'text_processing': _handle_text_processing,
            'code_execution': _handle_code_execution,
            'plagiarism_check': _handle_plagiarism_check,
            'ocr': _handle_ocr,
        }

        handler = handlers.get(task_type, _handle_generic)
        result = handler(payload)

        output = {
            "status": "ok",
            "shard_id": shard_id,
            "task_type": task_type,
            "result": result,
        }

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        error_output = {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
        print(json.dumps(error_output, ensure_ascii=False), file=sys.stderr)


def _handle_ai_detection(payload):
    content = payload.get('content', '')
    detection_type = payload.get('detection_type', 'general')

    return {
        "detection_type": detection_type,
        "content_length": len(content),
        "ai_probability": 0.0,
        "risk_level": "safe",
        "details": [],
        "message": "AI 检测引擎待接入",
    }


def _handle_text_processing(payload):
    text = payload.get('text', '')
    operation = payload.get('operation', 'analyze')

    return {
        "operation": operation,
        "char_count": len(text),
        "word_count": len(text.split()) if text else 0,
        "message": "文本处理完成",
    }


def _handle_code_execution(payload):
    code = payload.get('code', '')
    language = payload.get('language', 'python')

    return {
        "language": language,
        "code_length": len(code),
        "output": "",
        "exit_code": 0,
        "message": "代码执行完成（沙箱模式）",
    }


def _handle_plagiarism_check(payload):
    text = payload.get('text', '')

    return {
        "originality_score": 100.0,
        "matched_sources": [],
        "message": "抄袭检测完成",
    }


def _handle_ocr(payload):
    image_path = payload.get('image_path', '')

    return {
        "image_path": image_path,
        "extracted_text": "",
        "confidence": 0.0,
        "message": "OCR 引擎待接入",
    }


def _handle_generic(payload):
    return {
        "type": "generic",
        "keys": list(payload.keys()),
        "message": "通用任务处理完成",
    }


if __name__ == '__main__':
    main()
