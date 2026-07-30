# -*- coding: utf-8 -*-
"""
支付宝支付客户端封装
支持：电脑网站支付(alipay.trade.page.pay) + 手机网站支付(alipay.trade.wap.pay)
通用接口：交易查询、退款、退款查询
异步通知：支付宝回调验签处理

兼容性说明：
- Python 3.14 + alipay-sdk-python 3.7.x 存在 rsa/pyasn1 兼容性问题
- 本模块通过 monkey-patch 用 cryptography 替代 rsa 库解决签名问题
- 支持自动将 PKCS#8 私钥转换为 PKCS#1 格式
"""

import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any

from django.conf import settings

logger = logging.getLogger(__name__)

# 延迟导入，避免未安装SDK时报错
_alipay_sdk_available = False
try:
    from alipay.aop.api.AlipayClientConfig import AlipayClientConfig
    from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient
    from alipay.aop.api.request.AlipayTradePagePayRequest import AlipayTradePagePayRequest
    from alipay.aop.api.request.AlipayTradeWapPayRequest import AlipayTradeWapPayRequest
    from alipay.aop.api.request.AlipayTradeQueryRequest import AlipayTradeQueryRequest
    from alipay.aop.api.request.AlipayTradeRefundRequest import AlipayTradeRefundRequest
    from alipay.aop.api.domain.AlipayTradePagePayModel import AlipayTradePagePayModel
    from alipay.aop.api.domain.AlipayTradeWapPayModel import AlipayTradeWapPayModel
    from alipay.aop.api.domain.AlipayTradeQueryModel import AlipayTradeQueryModel
    from alipay.aop.api.domain.AlipayTradeRefundModel import AlipayTradeRefundModel
    _alipay_sdk_available = True

    # ===== Python 3.14 兼容性修复 =====
    # alipay-sdk-python 内部使用 rsa 库做签名，但 Python 3.14 下 rsa/pyasn1 不兼容
    # 这里 monkey-patch 签名函数，改用 cryptography 库（稳定兼容）
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, utils as asym_utils
        from cryptography.hazmat.backends import default_backend

        def _sign_with_rsa2_cryptography(private_key_pem: str, sign_content: str, charset: str = 'utf-8') -> str:
            """使用 cryptography 库进行 RSA2 (SHA256WithRSA) 签名，替代 rsa 库
            自动检测并转换 PKCS#8 / PKCS#1 格式
            返回: base64 编码的签名字符串
            """
            import base64
            from cryptography.hazmat.primitives import serialization

            private_key = None
            last_err = None

            # 策略1: 尝试作为纯 base64 密钥加载（PKCS#8 格式）
            for pem_header, pem_footer in [
                ('-----BEGIN PRIVATE KEY-----', '-----END PRIVATE KEY-----'),
                ('-----BEGIN RSA PRIVATE KEY-----', '-----END RSA PRIVATE KEY-----'),
            ]:
                try:
                    pem_data = f'{pem_header}\n{private_key_pem}\n{pem_footer}'.encode()
                    private_key = serialization.load_pem_private_key(pem_data, password=None)
                    break
                except Exception as e:
                    last_err = e
                    continue

            if not private_key:
                # 策略2: 如果上面都失败，尝试原始字符串可能已经包含 PEM 头
                try:
                    private_key = serialization.load_pem_private_key(
                        private_key_pem.encode() if isinstance(private_key_pem, str) else private_key_pem,
                        password=None
                    )
                except Exception as e:
                    last_err = e

            if not private_key:
                raise ValueError(f"无法加载支付宝私钥（已尝试 PKCS#8 和 PKCS#1 格式）: {last_err}")

            sign_bytes = sign_content.encode(charset) if isinstance(sign_content, str) else sign_content
            signature = private_key.sign(
                sign_bytes,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            # SDK 期望 base64 编码的字符串，不是原始 bytes
            return base64.b64encode(signature).decode('utf-8')

        # 替换 SDK 内部的签名函数（两处都要替换）
        from alipay.aop.api.util import SignatureUtils
        import alipay.aop.api.DefaultAlipayClient as _dac_module

        _new_sign_fn = _sign_with_rsa2_cryptography
        SignatureUtils.sign_with_rsa2 = _new_sign_fn
        _dac_module.sign_with_rsa2 = _new_sign_fn
        logger.info("[Alipay] 已启用 cryptography 签名引擎（Python 3.14 兼容模式）")

    except ImportError:
        logger.warning("[Alipay] cryptography 未安装，使用默认 rsa 库签名（可能不兼容 Python 3.14）")
    except Exception as e:
        logger.warning(f"[Alipay] 签名引擎切换失败，使用默认 rsa 库: {e}")

except ImportError:
    logger.warning("alipay-sdk-python not installed. Run: pip install alipay-sdk-python")


def get_alipay_config() -> Dict[str, Any]:
    """从 Django settings 获取支付宝配置，返回配置字典"""
    is_sandbox = getattr(settings, 'ALIPAY_SANDBOX', True)

    config = {
        'sandbox': is_sandbox,
        # 沙箱环境使用沙箱网关，生产环境使用正式网关
        'server_url': getattr(
            settings,
            'ALIPAY_SANDBOX_GATEWAY',
            'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
        ) if is_sandbox else getattr(
            settings,
            'ALIPAY_GATEWAY',
            'https://openapi.alipay.com/gateway.do'
        ),
        'app_id': getattr(settings, 'ALIPAY_APP_ID', ''),
        # Python 属于非 JAVA 语言，必须使用 PKCS#1 格式私钥 (appPrivatePkcsKey)
        'app_private_key': getattr(settings, 'ALIPAY_PRIVATE_KEY', ''),
        'alipay_public_key': getattr(settings, 'ALIPAY_PUBLIC_KEY', ''),
        'charset': 'utf-8',
        'sign_type': 'RSA2',
        # 回调地址
        'notify_url': getattr(settings, 'ALIPAY_NOTIFY_URL', ''),
        'return_url': getattr(settings, 'ALIPAY_RETURN_URL', ''),
    }
    return config


def create_client():
    """
    创建支付宝 SDK 客户端实例（单次使用）
    每次调用重新创建，确保配置最新
    """
    if not _alipay_sdk_available:
        raise RuntimeError(
            "支付宝 SDK 未安装，请执行: pip install alipay-sdk-python"
        )

    cfg = get_alipay_config()

    if not cfg['app_id'] or not cfg['app_private_key']:
        raise ValueError(
            "支付宝配置不完整，请在 settings 中配置 "
            "ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY"
        )

    client_config = AlipayClientConfig()
    client_config.server_url = cfg['server_url']
    client_config.app_id = cfg['app_id']
    client_config.app_private_key = cfg['app_private_key']
    client_config.alipay_public_key = cfg['alipay_public_key']
    client_config.charset = cfg['charset']
    client_config.sign_type = cfg['sign_type']

    return DefaultAlipayClient(alipay_client_config=client_config), cfg


class AlipayService:
    """支付宝支付服务 — 统一封装电脑网站/手机网站支付 + 通用接口"""

    @staticmethod
    def page_pay(order_no: str, total_amount: str, subject: str,
                 body: str = '', return_url: str = '',
                 notify_url: str = '', passback_params: str = '') -> str:
        """
        电脑网站支付 — 生成支付表单 HTML
        使用 page_execute() 方法（页面跳转类 API 必须用此方法）

        Args:
            order_no: 商户订单号
            total_amount: 订单金额（字符串，如 "99.00"）
            subject: 订单标题
            body: 订单描述
            return_url: 支付完成同步跳转地址
            notify_url: 异步通知地址
            passback_params: 公共回传参数

        Returns:
            HTML 表单字符串（含自动提交脚本），前端需渲染并提交
        """
        client, cfg = create_client()

        request = AlipayTradePagePayRequest()
        model = AlipayTradePagePayModel()
        model.out_trade_no = order_no
        model.total_amount = total_amount
        model.subject = subject
        model.body = body or (subject + ' - 一鉴到底AI检测平台')
        model.product_code = 'FAST_INSTANT_TRADE_PAY'

        if return_url:
            request.return_url = return_url
        if notify_url:
            request.notify_url = notify_url
        else:
            request.notify_url = cfg.get('notify_url', '')
        if passback_params:
            model.passback_params = passback_params

        request.biz_model = model

        # 页面跳转类 API 必须使用 page_execute()，禁止使用 execute()
        html_form = client.page_execute(request)

        logger.info(f"[Alipay] Page pay form generated for order {order_no}, amount={total_amount}")
        return html_form

    @staticmethod
    def wap_pay(order_no: str, total_amount: str, subject: str,
                body: str = '', quit_url: str = '', return_url: str = '',
                notify_url: str = '', passback_params: str = '') -> str:
        """
        手机网站支付 — 生成 WAP 支付表单 HTML
        使用 page_execute() 方法（页面跳转类 API 必须用此方法）

        Args:
            order_no: 商户订单号
            total_amount: 订单金额
            subject: 订单标题
            body: 订单描述
            quit_url: 用户中途退出返回商户网站的地址（必填）
            return_url: 同步跳转地址
            notify_url: 异步通知地址
            passback_params: 公共回传参数

        Returns:
            HTML 表单字符串
        """
        client, cfg = create_client()

        request = AlipayTradeWapPayRequest()
        model = AlipayTradeWapPayModel()
        model.out_trade_no = order_no
        model.total_amount = total_amount
        model.subject = subject
        model.body = body or (subject + ' - 一鉴到底AI检测平台')
        model.product_code = 'QUICK_WAP_WAY'
        model.quit_url = quit_url or (getattr(settings, 'ALIPAY_QUIT_URL', '') or cfg.get('return_url', ''))

        if return_url:
            request.return_url = return_url
        if notify_url:
            request.notify_url = notify_url
        else:
            request.notify_url = cfg.get('notify_url', '')
        if passback_params:
            model.passback_params = passback_params

        request.biz_model = model

        # 页面跳转类 API 必须使用 page_execute()
        html_form = client.page_execute(request)

        logger.info(f"[Alipay] WAP pay form generated for order {order_no}, amount={total_amount}")
        return html_form

    @staticmethod
    def query_trade(out_trade_no: str = '', trade_no: str = '') -> Dict[str, Any]:
        """
        统一收单交易查询
        使用 execute() 方法（服务端 API 用此方法）

        Returns:
            {
                'success': bool,
                'trade_status': str,  # TRADE_SUCCESS / TRADE_CLOSED / WAIT_BUYER_PAY 等
                'total_amount': str,
                'buyer_logon_id': str,
                'raw_response': dict,
            }
        """
        client, _cfg = create_client()

        request = AlipayTradeQueryRequest()
        model = AlipayTradeQueryModel()

        if out_trade_no:
            model.out_trade_no = out_trade_no
        if trade_no:
            model.trade_no = trade_no

        request.biz_model = model

        # 服务端 API 使用 execute()
        response_str = client.execute(request)
        response = json.loads(response_str)

        result = response.get('alipay_trade_query_response', {})

        success = result.get('code') == '10000'
        logger.info(f"[Alipay] Query trade {'success' if success else 'failed'}: "
                     f"out_trade_no={out_trade_no} code={result.get('code')} msg={result.get('msg')}")

        return {
            'success': success,
            'code': result.get('code'),
            'msg': result.get('msg'),
            'trade_status': result.get('trade_status'),
            'trade_no': result.get('trade_no'),
            'out_trade_no': out_trade_no,
            'total_amount': result.get('total_amount'),
            'buyer_logon_id': result.get('buyer_logon_id'),
            'raw_response': result,
        }

    @staticmethod
    def refund(out_trade_no: str = '', trade_no: str = '',
               refund_amount: str = '', refund_reason: str = '正常退款',
               out_request_no: str = '') -> Dict[str, Any]:
        """
        统一收单交易退款
        使用 execute() 方法

        Returns:
            {
                'success': bool,
                'trade_no': str,
                'refund_fee': str,
                'raw_response': dict,
            }
        """
        client, _cfg = create_client()

        request = AlipayTradeRefundRequest()
        model = AlipayTradeRefundModel()

        if out_trade_no:
            model.out_trade_no = out_trade_no
        if trade_no:
            model.trade_no = trade_no
        model.refund_amount = refund_amount
        model.refund_reason = refund_reason
        if out_request_no:
            model.out_request_no = out_request_no

        request.biz_model = model

        response_str = client.execute(request)
        response = json.loads(response_str)

        result = response.get('alipay_trade_refund_response', {})
        success = result.get('code') == '10000'

        logger.info(f"[Alipay] Refund {'success' if success else 'failed'}: "
                     f"out_trade_no={out_trade_no} amount={refund_amount}")

        return {
            'success': success,
            'code': result.get('code'),
            'msg': result.get('msg'),
            'trade_no': result.get('trade_no'),
            'out_trade_no': out_trade_no,
            'refund_fee': result.get('refund_fee'),
            'fund_change': result.get('fund_change'),
            'raw_response': result,
        }

    @staticmethod
    def verify_notify(post_data: Dict) -> bool:
        """
        验证支付宝异步通知签名
        收到异步通知后必须先验签，确保通知来自支付宝

        Args:
            post_data: 支付宝 POST 过来的原始数据字典

        Returns:
            True: 验签通过（通知来自支付宝）
            False: 验签失败
        """
        if not _alipay_sdk_available:
            logger.error("[Alipay] SDK not installed, cannot verify signature")
            return False

        try:
            from alipay.aop.api.AlipayPublicKey import AlipayPublicKey
            from alipay.aop.api.util.SignatureUtils import SignatureUtils

            cfg = get_alipay_config()
            public_key = AlipayPublicKey(cfg['alipay_public_key'])

            # 签名参数排除 sign 和 sign_type
            sign = post_data.pop('sign', None)
            sign_type = post_data.pop('sign_type', None)

            if not sign:
                logger.warning("[Alipay] No signature in notify data")
                return False

            string_to_sign = '&'.join([
                f"{k}={post_data[k]}" for k in sorted(post_data.keys()) if post_data[k]
            ])

            verified = SignatureUtils.verify(string_to_sign, sign, sign_type or 'RSA2', public_key)
            if verified:
                logger.info("[Alipay] Notify signature verified successfully")
            else:
                logger.warning("[Alipay] Notify signature verification failed")
            return verified

        except Exception as e:
            logger.exception(f"[Alipay] Verify notify error: {e}")
            return False


def format_timestamp(dt=None):
    """格式化时间戳为支付宝要求的格式: yyyy-MM-dd HH:mm:ss"""
    if dt is None:
        dt = datetime.now()
    return dt.strftime("%Y-%m-%d %H:%M:%S")
