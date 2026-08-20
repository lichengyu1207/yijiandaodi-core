import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Download, CheckCircle, Terminal, Laptop } from 'lucide-react';

// 平台图标组件
const WindowsIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.5L10 2.25V11.75H0V3.5ZM11 2.1L24 0V11.75H11V2.1ZM0 12.25H10V21.75L0 20.5V12.25ZM11 12.25H24V24L11 21.9V12.25Z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5C17.83 20.58 16.82 21.56 15.68 21.56C14.54 21.56 14.18 20.87 12.89 20.87C11.6 20.87 11.18 21.56 10.12 21.56C9.06 21.56 8.2 20.62 7.18 19.42C4.86 16.56 4.5 12.8 6.5 10.8C7.8 9.5 9.7 9.4 10.9 9.4C12.1 9.4 13.1 10.2 13.9 10.2C14.7 10.2 15.9 9.3 17.3 9.3C18.5 9.3 20.1 9.9 21.1 11.1C17.8 13.1 18.4 17.5 21.7 19.3C21.1 19.9 20.5 20.3 19.9 20.6C19.3 20.3 18.9 19.9 18.71 19.5ZM14.3 7.7C14.9 7 15.3 6 15.3 5C15.3 4.9 15.3 4.8 15.3 4.7C14.3 4.8 13.2 5.3 12.5 6.1C11.9 6.8 11.5 7.8 11.6 8.8C11.6 8.9 11.6 9 11.6 9.1C12.7 9.1 13.7 8.6 14.3 7.7Z"/>
  </svg>
);

const LinuxIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.5 2C11.5 2 10.5 2.5 10 3.5C9.5 2.5 8.5 2 7.5 2C6 2 4.5 3 4 4.5C3.5 6 4 7.5 5 8.5L5.5 9L6 8.5C5.5 8 5.2 7.2 5.5 6.5C5.8 5.5 6.8 5 7.8 5.2C8.8 5.4 9.5 6.2 9.5 7.2V8H10.5V7.2C10.5 6.2 11.2 5.4 12.2 5.2C13.2 5 14.2 5.5 14.5 6.5C14.8 7.2 14.5 8 14 8.5L14.5 9L15 8.5C16 7.5 16.5 6 16 4.5C15.5 3 14 2 12.5 2Z"/>
    <path d="M12 9C10 9 8 10 7 12L4 18C3.5 19 4 20 5 20H19C20 20 20.5 19 20 18L17 12C16 10 14 9 12 9ZM12 11C13.5 11 14.8 11.8 15.5 13L17.5 17H6.5L8.5 13C9.2 11.8 10.5 11 12 11Z"/>
  </svg>
);

const DownloadPage: React.FC = () => {
  const downloads = [
    {
      platform: 'Windows',
      icon: WindowsIcon,
      version: 'v2.0.0',
      size: '161MB',
      url: 'https://github.com/lichengyu1207/yijiandaodi-core/releases/download/v2.0.0/yijiandaodi-desktop-setup-2.0.0.exe',
      recommended: true,
      available: true,
      description: '安装程序（NSIS 安装包，可自选目录，含后端/推理服务）',
    },
    {
      platform: 'macOS',
      icon: AppleIcon,
      version: 'v2.0.0',
      size: '即将推出',
      url: '#',
      recommended: false,
      available: false,
    },
    {
      platform: 'Linux',
      icon: LinuxIcon,
      version: 'v2.0.0',
      size: '即将推出',
      url: '#',
      recommended: false,
      available: false,
    },
  ];

  const features = [
    '本地安全扫描，无需上传数据',
    '多Agent协同检测引擎',
    '实时行为监控与分析',
    '离线使用，隐私保护',
    '一键生成检测报告',
    '支持API接口调用',
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      padding: '80px 20px',
    }}>
      <div style={{
        maxWidth: 1000,
        margin: '0 auto',
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 60 }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}>
            <Monitor size={48} color="#14B8A6" />
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            color: '#F8FAFC',
            margin: 0,
            marginBottom: 16,
          }}>
            下载桌面客户端
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: 'rgba(148,163,184,0.8)',
            margin: 0,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            一鉴到底桌面端，离线使用更安全，本地扫描更快速
          </p>
        </motion.div>

        {/* Download Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          marginBottom: 60,
        }}>
          {downloads.map((item, index) => (
            <motion.div
              key={item.platform}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(30,41,59,0.6)',
                border: item.recommended ? '2px solid #14B8A6' : '1px solid rgba(148,163,184,0.1)',
                borderRadius: 16,
                padding: 32,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {item.recommended && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #14B8A6, #06B6D4)',
                  color: '#fff',
                  padding: '4px 16px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                推荐
              </div>
              )}
              <item.icon size={40} color={item.recommended ? '#14B8A6' : '#94A3B8'} />
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#F8FAFC',
                margin: '16px 0 8px',
              }}>
                {item.platform}
              </h3>
              <p style={{
                color: 'rgba(148,163,184,0.6)',
                fontSize: '0.9rem',
                marginBottom: 8,
              }}>
                {item.version} · {item.size}
              </p>
              {item.description && (
                <p style={{
                  color: 'rgba(148,163,184,0.5)',
                  fontSize: '0.75rem',
                  marginBottom: 8,
                }}>
                  {item.description}
                </p>
              )}
              {item.available ? (
                <a
                  href={item.url}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 16,
                    padding: '12px 32px',
                    background: item.recommended 
                      ? 'linear-gradient(135deg, #14B8A6, #06B6D4)' 
                      : 'rgba(148,163,184,0.1)',
                    color: '#fff',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontWeight: 600,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Download size={18} />
                  立即下载
                </a>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 16,
                    padding: '12px 32px',
                    background: 'rgba(148,163,184,0.1)',
                    color: 'rgba(148,163,184,0.5)',
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  即将推出
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            background: 'rgba(30,41,59,0.4)',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: 16,
            padding: 40,
          }}
        >
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#F8FAFC',
            margin: '0 0 24px',
            textAlign: 'center',
          }}>
            桌面端特性
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {features.map((feature, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'rgba(224,242,254,0.8)',
                  fontSize: '0.95rem',
                }}
              >
                <CheckCircle size={18} color="#14B8A6" />
                {feature}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mobile hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            marginTop: 40,
            textAlign: 'center',
          }}
        >
          <p style={{
            color: 'rgba(148,163,184,0.5)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Smartphone size={16} />
            移动端用户可直接在浏览器中使用，无需下载
          </p>
        </motion.div>

        {/* 使用引导 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            marginTop: 40,
            background: 'rgba(30,41,59,0.4)',
            border: '1px solid rgba(148,163,184,0.1)',
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h2 style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#F8FAFC',
            margin: '0 0 20px',
            textAlign: 'center',
          }}>
            📥 使用引导
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {[
              { step: 1, title: '下载', desc: '点击上方"立即下载"按钮，下载 Windows 安装程序（Setup.exe）' },
              { step: 2, title: '安装', desc: '双击运行安装程序，选择安装目录（支持 C 盘或 D 盘）' },
              { step: 3, title: '启动', desc: '安装完成自动启动"一鉴到底"桌面端' },
              { step: 4, title: '使用', desc: '首次使用需设置账号密码，之后即可离线使用安全检测功能' },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '12px 16px',
                  background: 'rgba(20,184,166,0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(20,184,166,0.2)',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #14B8A6, #06B6D4)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#F8FAFC',
                    marginBottom: 4,
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'rgba(148,163,184,0.8)',
                  }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 20,
            padding: '12px 16px',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 8,
          }}>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'rgba(251,191,36,0.9)',
            }}>
              💡 提示：安装程序已内置后端与推理服务，无需安装 Node.js 或 Python。若官网下载较慢，可前往 GitHub Releases 下载。
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DownloadPage;