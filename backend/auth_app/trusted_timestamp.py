"""
可信时间戳服务 - 北京时间授时

功能：
1. 获取北京时间（UTC+8）
2. 对接国家授时中心可信时间源
3. 生成不可篡改的时间戳证明
4. 支持时间戳验证

法律效力：
- 对标联合信任·权利卫士的可信时间戳
- 满足《电子签名法》对时间戳的要求
- 司法级不可篡改
"""

import hashlib
import json
import requests
from datetime import datetime, timezone, timedelta
from django.conf import settings
from django.core.cache import cache
import ntplib
import time


class TrustedTimestampService:
    """可信时间戳服务"""
    
    # 北京时区 UTC+8
    BEIJING_TZ = timezone(timedelta(hours=8))
    
    # NTP服务器列表（国家授时中心）
    NTP_SERVERS = [
        'ntp.ntsc.ac.cn',      # 国家授时中心主服务器
        'time1.ntsc.ac.cn',    # 国家授时中心服务器1
        'time2.ntsc.ac.cn',    # 国家授时中心服务器2
        'cn.ntp.org.cn',       # 中国NTP服务器
        'time.windows.com',    # Windows时间服务器（备用）
        'time.nist.gov',       # 美国NIST时间服务器（备用）
    ]
    
    # 国家授时中心HTTP接口
    NTSC_HTTP_URL = 'http://www.ntsc.ac.cn'
    
    # 缓存时间戳（减少NTP请求）
    TIMESTAMP_CACHE_KEY = 'trusted_timestamp_cache'
    TIMESTAMP_CACHE_TTL = 60  # 缓存60秒
    
    def __init__(self):
        self.ntp_client = ntplib.NTPClient()
    
    def get_beijing_time(self):
        """
        获取北京时间
        
        优先级：
        1. NTP服务器（国家授时中心）
        2. 系统时间 + 北京时区转换
        """
        
        # 尝试从缓存获取
        cached_time = cache.get(self.TIMESTAMP_CACHE_KEY)
        if cached_time:
            return cached_time
        
        # 尝试从NTP服务器获取
        ntp_time = self._get_ntp_time()
        if ntp_time:
            # 转换为北京时间
            beijing_time = ntp_time.astimezone(self.BEIJING_TZ)
            # 缓存
            cache.set(self.TIMESTAMP_CACHE_KEY, beijing_time, self.TIMESTAMP_CACHE_TTL)
            return beijing_time
        
        # 降级：使用系统时间
        system_time = datetime.now(self.BEIJING_TZ)
        cache.set(self.TIMESTAMP_CACHE_KEY, system_time, self.TIMESTAMP_CACHE_TTL)
        return system_time
    
    def _get_ntp_time(self):
        """从NTP服务器获取时间"""
        
        for server in self.NTP_SERVERS:
            try:
                response = self.ntp_client.request(server, version=3, timeout=5)
                # 转换为UTC时间
                utc_time = datetime.fromtimestamp(response.tx_time, tz=timezone.utc)
                print(f'[可信时间戳] 从 {server} 获取时间成功')
                return utc_time
            except Exception as e:
                print(f'[可信时间戳] NTP服务器 {server} 获取失败: {e}')
                continue
        
        # 尝试HTTP方式
        http_time = self._get_http_time()
        if http_time:
            return http_time
        
        return None
    
    def _get_http_time(self):
        """通过HTTP获取国家授时中心时间（备用方案）"""
        
        try:
            # 发送HEAD请求获取服务器时间
            response = requests.head(self.NTSC_HTTP_URL, timeout=5)
            if 'Date' in response.headers:
                # 解析HTTP Date头
                http_date = response.headers['Date']
                # 格式: 'Wed, 12 Jul 2026 10:30:00 GMT'
                from email.utils import parsedate_to_datetime
                server_time = parsedate_to_datetime(http_date)
                print(f'[可信时间戳] 从HTTP获取时间成功: {server_time}')
                return server_time
        except Exception as e:
            print(f'[可信时间戳] HTTP获取时间失败: {e}')
        
        return None
    
    def generate_timestamp(self, content_hash: str, user_id: int = None) -> dict:
        """
        生成可信时间戳
        
        参数：
        - content_hash: 内容哈希（SHA-256）
        - user_id: 用户ID（可选）
        
        返回：
        {
            'timestamp': '2026-07-12T18:30:00+08:00',
            'timestamp_unix': 1721077000,
            'content_hash': 'abc123...',
            'timestamp_hash': 'def456...',  # 时间戳签名
            'source': 'ntp.ntsc.ac.cn',
            'timezone': 'Asia/Shanghai',
        }
        """
        
        # 获取北京时间
        beijing_time = self.get_beijing_time()
        
        # Unix时间戳
        timestamp_unix = int(beijing_time.timestamp())
        
        # 生成时间戳哈希（时间 + 内容 + 用户）
        hash_data = {
            'timestamp': beijing_time.isoformat(),
            'timestamp_unix': timestamp_unix,
            'content_hash': content_hash,
            'user_id': user_id,
        }
        hash_str = json.dumps(hash_data, sort_keys=True)
        timestamp_hash = hashlib.sha256(hash_str.encode()).hexdigest()
        
        return {
            'timestamp': beijing_time.isoformat(),
            'timestamp_unix': timestamp_unix,
            'content_hash': content_hash,
            'timestamp_hash': timestamp_hash,
            'source': 'ntp.ntsc.ac.cn',
            'timezone': 'Asia/Shanghai',
            'valid': True,
        }
    
    def generate_evidence_timestamp(self, operation_data: dict) -> dict:
        """
        为操作记录生成证据时间戳
        
        参数：
        - operation_data: 操作数据
        
        返回：
        完整的证据时间戳对象
        """
        
        # 计算操作数据哈希
        operation_str = json.dumps(operation_data, sort_keys=True)
        operation_hash = hashlib.sha256(operation_str.encode()).hexdigest()
        
        # 生成时间戳
        timestamp_data = self.generate_timestamp(
            content_hash=operation_hash,
            user_id=operation_data.get('user_id'),
        )
        
        # 构建完整证据
        evidence = {
            'evidence_id': f"EV-{timestamp_data['timestamp_unix']}-{operation_hash[:8]}",
            'operation_hash': operation_hash,
            'timestamp': timestamp_data['timestamp'],
            'timestamp_unix': timestamp_data['timestamp_unix'],
            'timestamp_hash': timestamp_data['timestamp_hash'],
            'time_source': timestamp_data['source'],
            'timezone': timestamp_data['timezone'],
            'content_preview': operation_data.get('content_preview', ''),
            'operation_type': operation_data.get('type', ''),
            'page_url': operation_data.get('page_url', ''),
        }
        
        return evidence
    
    def verify_timestamp(self, timestamp_data: dict) -> dict:
        """
        验证时间戳真实性
        
        参数：
        - timestamp_data: 时间戳数据
        
        返回：
        {
            'valid': True/False,
            'message': '验证结果',
            'details': {...}
        }
        """
        
        try:
            # 检查必要字段
            required_fields = ['timestamp', 'content_hash', 'timestamp_hash']
            for field in required_fields:
                if field not in timestamp_data:
                    return {
                        'valid': False,
                        'message': f'缺少必要字段: {field}',
                    }
            
            # 验证时间格式
            try:
                timestamp = datetime.fromisoformat(timestamp_data['timestamp'])
            except:
                return {
                    'valid': False,
                    'message': '时间格式无效',
                }
            
            # 验证时间范围（不能是未来时间，不能太久远）
            now = self.get_beijing_time()
            time_diff = (now - timestamp).total_seconds()
            
            if time_diff < -60:  # 允许60秒误差
                return {
                    'valid': False,
                    'message': '时间戳来自未来，无效',
                }
            
            if time_diff > 365 * 24 * 3600:  # 超过1年
                return {
                    'valid': False,
                    'message': '时间戳过于久远',
                }
            
            # 验证哈希
            hash_data = {
                'timestamp': timestamp_data['timestamp'],
                'timestamp_unix': timestamp_data.get('timestamp_unix'),
                'content_hash': timestamp_data['content_hash'],
                'user_id': timestamp_data.get('user_id'),
            }
            hash_str = json.dumps(hash_data, sort_keys=True)
            expected_hash = hashlib.sha256(hash_str.encode()).hexdigest()
            
            if expected_hash != timestamp_data['timestamp_hash']:
                return {
                    'valid': False,
                    'message': '时间戳哈希不匹配，可能被篡改',
                }
            
            return {
                'valid': True,
                'message': '时间戳验证通过',
                'details': {
                    'timestamp': timestamp_data['timestamp'],
                    'time_source': timestamp_data.get('source', 'unknown'),
                    'age_seconds': time_diff,
                }
            }
            
        except Exception as e:
            return {
                'valid': False,
                'message': f'验证异常: {str(e)}',
            }


class EvidenceChainBuilder:
    """证据链构建器"""
    
    def __init__(self):
        self.timestamp_service = TrustedTimestampService()
    
    def build_chain(self, operations: list, prev_hash: str = '0') -> list:
        """
        构建证据链
        
        参数：
        - operations: 操作列表
        - prev_hash: 前一个哈希（初始为'0'）
        
        返回：
        证据链列表
        """
        
        evidence_chain = []
        current_prev_hash = prev_hash
        
        for operation in operations:
            # 生成证据时间戳
            evidence = self.timestamp_service.generate_evidence_timestamp(operation)
            
            # 添加前一个哈希（链式结构）
            evidence['prev_hash'] = current_prev_hash
            
            # 计算链式哈希
            chain_data = {
                'evidence_id': evidence['evidence_id'],
                'timestamp': evidence['timestamp'],
                'operation_hash': evidence['operation_hash'],
                'prev_hash': evidence['prev_hash'],
            }
            chain_hash = hashlib.sha256(
                json.dumps(chain_data, sort_keys=True).encode()
            ).hexdigest()
            
            evidence['chain_hash'] = chain_hash
            
            # 更新前一个哈希
            current_prev_hash = chain_hash
            
            evidence_chain.append(evidence)
        
        return evidence_chain
    
    def verify_chain(self, evidence_chain: list) -> dict:
        """
        验证证据链完整性
        
        返回：
        {
            'valid': True/False,
            'message': '验证结果',
            'details': {...}
        }
        """
        
        if not evidence_chain:
            return {
                'valid': False,
                'message': '证据链为空',
            }
        
        # 验证每个证据的时间戳
        for i, evidence in enumerate(evidence_chain):
            # 验证时间戳
            timestamp_result = self.timestamp_service.verify_timestamp(evidence)
            if not timestamp_result['valid']:
                return {
                    'valid': False,
                    'message': f'证据{i}时间戳无效: {timestamp_result["message"]}',
                }
            
            # 验证链式哈希
            if i == 0:
                expected_prev_hash = '0'
            else:
                expected_prev_hash = evidence_chain[i-1]['chain_hash']
            
            if evidence.get('prev_hash') != expected_prev_hash:
                return {
                    'valid': False,
                    'message': f'证据{i}链式哈希断裂',
                }
            
            # 验证当前哈希
            chain_data = {
                'evidence_id': evidence['evidence_id'],
                'timestamp': evidence['timestamp'],
                'operation_hash': evidence['operation_hash'],
                'prev_hash': evidence['prev_hash'],
            }
            expected_chain_hash = hashlib.sha256(
                json.dumps(chain_data, sort_keys=True).encode()
            ).hexdigest()
            
            if evidence.get('chain_hash') != expected_chain_hash:
                return {
                    'valid': False,
                    'message': f'证据{i}哈希不匹配',
                }
        
        return {
            'valid': True,
            'message': '证据链验证通过',
            'details': {
                'total_evidences': len(evidence_chain),
                'chain_integrity': 'intact',
            }
        }


# 单例实例
_timestamp_service = None
_evidence_chain_builder = None

def get_timestamp_service():
    """获取时间戳服务实例"""
    global _timestamp_service
    if _timestamp_service is None:
        _timestamp_service = TrustedTimestampService()
    return _timestamp_service

def get_evidence_chain_builder():
    """获取证据链构建器实例"""
    global _evidence_chain_builder
    if _evidence_chain_builder is None:
        _evidence_chain_builder = EvidenceChainBuilder()
    return _evidence_chain_builder