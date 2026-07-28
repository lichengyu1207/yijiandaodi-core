import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import KOLShowcase from '@/components/KOLShowcase';
import AdCooperation from '@/components/AdCooperation';
import CustomerServiceSOP from '@/components/CustomerServiceSOP';
import CreatorPlatform from '@/components/CreatorPlatform';
import KnowledgeBaseShowcase from '@/components/KnowledgeBaseShowcase';
import { Shield, Users, Target, TrendingUp, MessageSquare, Mail, Phone, Clock, CheckCircle2, Award, Globe, Handshake, Crown, Building2, GraduationCap, ArrowRight } from 'lucide-react';

const CONTACT_EMAIL = 'lichengyu@fangsuanyun.cn';

const About: React.FC = () => {
  const navigate = useNavigate();
  const kolRef = useRef<HTMLDivElement>(null);
  const adRef = useRef<HTMLDivElement>(null);
  useSEO(
    '关于我们 - 一鉴到底',
    '一鉴到底是国内领先的 AI Agent 安全检测平台，提供企业级安全解决方案、培训课程和商务合作',
    ['关于一鉴到底', 'AI安全', 'Agent检测', '商务合作', 'KOL合作']
  );

  return (
    <div className="about-page" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
      <section style={{ textAlign: 'center', marginBottom: 56 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#1D2129', marginBottom: 16 }}>
          关于一鉴到底
        </h1>
        <p style={{ fontSize: 17, color: '#4E5969', lineHeight: 1.8, maxWidth: 680, margin: '0 auto' }}>
          我们专注 AI Agent 安全领域，为开发团队和企业提供从检测、防护到合规的一站式安全服务。
          已累计帮助超过 200 个项目发现并修复了 Agent 安全风险。
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 64 }}>
        {[
          { icon: Shield, label: '安全检测', value: '10万+', sub: '次Agent扫描' },
          { icon: Users, label: '服务客户', value: '200+', sub: '个项目/团队' },
          { icon: Target, label: '风险检出率', value: '98.5%', sub: '行业领先' },
          { icon: Award, label: '覆盖场景', value: '50+', sub: '安全检查项' },
        ].map((item) => (
          <div key={item.label} style={{
            background: '#FFFFFF', borderRadius: 12, padding: '28px 20px', textAlign: 'center',
            border: '1px solid #E5E6EB',
          }}>
            <item.icon size={28} color="#165DFF" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1D2129', marginBottom: 4 }}>{item.value}</div>
            <div style={{ fontSize: 14, color: '#86909C', marginBottom: 8 }}>{item.sub}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4E5969' }}>{item.label}</div>
          </div>
        ))}
      </section>

      <section style={{ background: '#F7F8FA', borderRadius: 16, padding: '48px 40px', marginBottom: 64 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1D2129', marginBottom: 32, textAlign: 'center' }}>
          我们的使命
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
          {[
            {
              title: '让 Agent 安全触手可及',
              desc: '把复杂的安全检测流程简化为一键操作，让每个开发者都能快速评估自己的 Agent 是否存在安全隐患。',
              icon: Shield,
            },
            {
              title: '构建行业安全标准',
              desc: '基于大量真实攻防案例，沉淀出一套可落地的 Agent 安全最佳实践，推动整个行业的规范化发展。',
              icon: TrendingUp,
            },
            {
              title: '陪伴开发者成长',
              desc: '不只是工具，更是学习平台。通过课程、社区、实战演练，帮助开发者系统掌握 AI 安全技能。',
              icon: Globe,
            },
          ].map((m) => (
            <div key={m.title} style={{
              background: '#FFFFFF', borderRadius: 12, padding: 28, border: '1px solid #E5E6EB',
            }}>
              <m.icon size={22} color="#165DFF" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1D2129', marginBottom: 10 }}>{m.title}</h3>
              <p style={{ fontSize: 14, color: '#4E5969', lineHeight: 1.75, margin: 0 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1D2129', marginBottom: 8 }}>产品与服务</h2>
        <p style={{ fontSize: 15, color: '#4E5969', marginBottom: 32 }}>从个人会员到企业定制，从技能培训到商务合作，满足不同场景需求。</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
          {[
            {
              icon: Crown,
              title: '年度会员',
              desc: 'VIP 超值版 ¥199/年 · 尊享版 ¥599/年，解锁全部检测额度与专属特权',
              tag: '热门',
              tagColor: '#FF7D00',
              tagBg: '#FFF7ED',
              path: '/pricing',
            },
            {
              icon: Building2,
              title: '企业定制服务',
              desc: '私有 RAG 部署（¥5000起）· 定制 Agent 开发（¥10000起），完整交付',
              tag: '咨询报价',
              tagColor: '#165DFF',
              tagBg: '#E8F3FF',
              path: '/enterprise-services',
            },
            {
              icon: GraduationCap,
              title: '课程培训',
              desc: 'AI Agent 安全开发实战（¥299）· RAG 搭建入门（¥99），系统学习',
              tag: '新课上线',
              tagColor: '#00B42A',
              tagBg: '#E8FFEA',
              path: '/courses',
            },
          ].map((b) => (
            <div
              key={b.title}
              onClick={() => navigate(b.path)}
              style={{
                background: '#FFFFFF', borderRadius: 12, padding: 28, border: '1px solid #E5E6EB',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease', cursor: 'pointer',
                position: 'relative',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <b.icon size={24} color="#165DFF" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1D2129', marginBottom: 8 }}>{b.title}</h3>
              <p style={{ fontSize: 14, color: '#4E5969', lineHeight: 1.7, margin: '0 0 16px' }}>{b.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 12,
                  background: b.tagBg, color: b.tagColor, fontWeight: 500,
                }}>{b.tag}</span>
                <ArrowRight size={16} color="#86909C" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 64 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1D2129', marginBottom: 8 }}>商务合作</h2>
        <p style={{ fontSize: 15, color: '#4E5969', marginBottom: 32 }}>无论是 KOL 内容合作还是广告投放，我们都欢迎洽谈。</p>
        <div className="about-business-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 48 }}>
          {[
            { icon: Handshake, title: 'KOL 合作', desc: '与中腰部安全/技术 KOL 联合推广，内容共创、联合直播、深度评测', tag: '开放申请', ref: kolRef },
            { icon: MegaphoneIcon, title: '广告投放', desc: '面向 AI 安全从业者的高质量精准流量，Banner/信息流/邮件多形式', tag: '了解详情', ref: adRef },
          ].map((b) => (
            <div
              key={b.title}
              onClick={() => b.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              style={{
                background: '#FFFFFF', borderRadius: 12, padding: 28, border: '1px solid #E5E6EB',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <b.icon size={22} color="#165DFF" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1D2129', marginBottom: 8 }}>{b.title}</h3>
              <p style={{ fontSize: 14, color: '#4E5969', lineHeight: 1.7, margin: '0 0 14px' }}>{b.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 12,
                  background: '#E8F3FF', color: '#165DFF', fontWeight: 500,
                }}>{b.tag}</span>
                <ArrowRight size={16} color="#86909C" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div ref={kolRef}>
        <KOLShowcase />
      </div>

      <div ref={adRef}>
        <AdCooperation />
      </div>

      <CustomerServiceSOP />

      <CreatorPlatform />

      <KnowledgeBaseShowcase />

      <section style={{
        background: '#1D2129', borderRadius: 16, padding: '48px 40px', marginTop: 64,
        color: '#FFFFFF',
      }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>联系我们</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            { icon: Mail, label: '商务合作', value: CONTACT_EMAIL },
            { icon: Mail, label: '企业咨询', value: CONTACT_EMAIL },
            { icon: Mail, label: 'KOL/广告', value: CONTACT_EMAIL },
            { icon: Clock, label: '响应时间', value: '30分钟内' },
          ].map((c) => (
            <div key={c.label} style={{ textAlign: 'center', minWidth: 140 }}>
              <c.icon size={24} color="#86909C" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontSize: 13, color: '#86909C', marginBottom: 4 }}>{c.label}</div>
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', textDecoration: 'none' }}>
                {c.value}
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

function MegaphoneIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
    </svg>
  );
}

export default About;
