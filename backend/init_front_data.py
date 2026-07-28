# -*- coding: utf-8 -*-
import os, sys, random, json, re, io, django
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()
from content_app.models import Category, Tag, FrontAuthor, Article
from datetime import datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(SCRIPT_DIR, 'front_data_content.json'), 'r', encoding='utf-8') as f:
    D = json.load(f)
F = D.get('fragments', {})

def clear_old_data():
    Article.objects.all().delete()
    try:
        from content_app.models import ArticleLike, ArticleComment
        ArticleLike.objects.all().delete(); ArticleComment.objects.all().delete()
    except: pass
    print('[OK] Cleared old data')

def create_categories():
    out = []
    for item in D['categories']:
        cat, _ = Category.objects.get_or_create(slug=item['slug'], defaults={'name': item['name'], 'icon': item['icon'], 'description': item['description'], 'sort_order': item['sort_order']})
        out.append(cat)
    print('[OK] Created %d categories' % len(out))
    return out

def create_tags():
    out = []
    for item in D['tags']:
        tag, _ = Tag.objects.get_or_create(slug=item['slug'], defaults={'name': item['name']})
        out.append(tag)
    print('[OK] Created %d tags' % len(out))
    return out

def create_authors():
    out = []
    for item in D['authors']:
        a, _ = FrontAuthor.objects.get_or_create(name=item['name'], defaults={'avatar': item['avatar'], 'bio': item['bio']})
        out.append(a)
    print('[OK] Created %d authors' % len(out))
    return out

CAT_MAP = {
    '安全审计': ('audit_titles', 'content_template_audit'),
    '合规检测': ('compliance_titles', 'content_template_compliance'),
    '身份验证': ('identity_titles', 'content_template_generic'),
    '数据存证': ('proof_titles', 'content_template_generic'),
    '漏洞扫描': ('vuln_titles', 'content_template_generic'),
    '风险评估': ('risk_titles', 'content_template_generic'),
    '应急响应': ('ir_titles', 'content_template_generic'),
    '行业动态': ('industry_titles', 'content_template_generic'),
}

def r(lst): return random.choice(lst)
def ri(lo, hi): return random.randint(lo, hi)

def build_content(cat_name, tpl):
    f = {}
    drf = F.get('date_range_fmt', '{m1}月{d1}日至{m2}月{d2}日')
    f['date_range'] = drf.format(m1=ri(1,12), d1=ri(1,28), m2=ri(1,12), d2=ri(1,28))
    f['target_system'] = r(D['_target_systems'])
    f['standard'] = r(F.get('standards_list', ['GB/T 22239']))
    f['methodology'] = r(F.get('methodologies_list', ['CARVER']))
    f['system_count'] = ri(3, 15); f['server_count'] = ri(20, 150); f['network_count'] = ri(5, 50)
    f['high_count'] = ri(1, 8); f['medium_count'] = ri(3, 12); f['low_count'] = ri(5, 20)
    f['data_type'] = r(D['_data_types'])
    f['issue1_title'] = r(D['_issue1_titles'])
    i1d = F.get('issue1_desc', '{module}:{param}')
    f['issue1_desc'] = i1d.format(module=r(D['_modules_login']), param=r(D['_issues_param']), impact=r(D['_impacts_get_db']))
    im1 = F.get('impact1_tpl', 'impact {n}')
    f['impact1'] = im1.format(n=ri(100,99999), money=ri(10,500))
    f['fix1'] = F.get('fix1_text', '')
    f['issue2_title'] = r(D['_issue2_titles'])
    i2d = F.get('issue2_desc', '{layer}:{issue}')
    f['issue2_desc'] = i2d.format(layer=r(D['_layers']), issue=r(D['_config_issues']))
    im2 = F.get('impact2_tpl', 'risk')
    f['impact2'] = im2.format(risk_type=r(D['_risk_types']))
    f['fix2'] = F.get('fix2_text', '')
    eu = F.get('effort_unit', '{n}人日')
    f['p0_count']=ri(1,3); f['p1_count']=ri(2,6); f['p2_count']=ri(3,10); f['p3_count']=ri(5,15)
    f['p0_effort']=eu.format(n=ri(1,5)); f['p1_effort']=eu.format(n=ri(3,10))
    f['p2_effort']=eu.format(n=ri(5,20)); f['p3_effort']=eu.format(n=ri(10,30))
    f['maturity_level'] = r(D['_maturity_levels'])
    f['strength1'] = r(D['_strengths']); f['strength2'] = r(D['_strengths'])
    f['weakness1'] = r(D['_weaknesses']); f['weakness2'] = r(D['_weaknesses'])

    if cat_name == F.get('cat_compliance', '合规检测'):
        regs = D.get('_regulations', [])
        f['regulation'] = r(regs).split('(')[0].replace('《','').replace('》','') if regs else ''
        orgs = D.get('_organizations', [])
        f['organization'] = r(orgs) if orgs else ''
        atypes = D.get('_assessment_types', [])
        f['assessment_type'] = r(atypes) if atypes else ''
        p, pa, fc = ri(40,80), ri(10,25), ri(3,12); tt = p+pa+fc
        f['passed_count']=p; f['partial_count']=pa; f['failed_count']=fc
        f['passed_pct']=str(round(p/tt*100,1)); f['partial_pct']=str(round(pa/tt*100,1)); f['failed_pct']=str(round(fc/tt*100,1))
        pi1 = D.get('_passed_items1', [])
        f['passed_item1']=r(pi1) if pi1 else ''; f['passed_detail1']=F.get('passed_detail1','')
        pi2 = D.get('_passed_items2', [])
        f['passed_item2']=r(pi2) if pi2 else ''; f['passed_detail2']=F.get('passed_detail2','')
        gi1 = D.get('_gap_items1', [])
        f['gap_item1']=r(gi1) if gi1 else ''; f['gap_status1']='部分符合'
        f['gap_desc1']=F.get('gap_desc1',''); f['gap_fix1']=F.get('gap_fix1','')
        f['gap_item2']=F.get('gap_item2_fallback','匿名化/去标识化处理'); f['gap_status2']='规划中'
        f['gap_desc2']=F.get('gap_desc2',''); f['gap_fix2']=F.get('gap_fix2','')
        fi1 = D.get('_fail_items1', [])
        f['fail_item1']=r(fi1) if fi1 else ''; f['fail_detail1']=F.get('fail_detail1','')
        f['requirement1']=f.get('regulation',''); f['current1']=F.get('current1','')
        c1t = F.get('consequence1_tpl', 'fine {n}')
        f['consequence1']=c1t.format(n=ri(5,50))
        f['activity_count']=ri(15,60)
        cdt = F.get('collect_desc_tpl', 'collect {n}')
        f['collect_desc']=cdt.format(n=ri(3,8))
        sdt = F.get('store_desc_tpl', 'store {n}')
        f['store_desc']=sdt.format(n=ri(6,36))
        udt = F.get('use_desc_tpl', 'use {option}')
        f['use_desc']=udt.format(option=r(D.get('_use_options',[''])))
        sht = F.get('share_desc_tpl', 'share {n}')
        f['share_desc']=sht.format(n=ri(2,8))
        ddt = F.get('delete_desc_tpl', 'delete {n}')
        f['delete_desc']=ddt.format(n=ri(7,30))
        f['phase1_task1']=F.get('phase1_task1',''); f['phase1_task2']=F.get('phase1_task2','')
        f['phase2_task1']=F.get('phase2_task1',''); f['phase2_task2']=F.get('phase2_task2','')
        f['phase3_task1']=F.get('phase3_task1',''); f['phase3_task2']=F.get('phase3_task2','')
    else:
        topic = r(D.get('topic_words', ['security']))
        trends = D.get('_trends', [])
        trend = r(trends) if trends else ''
        entities = D.get('_entities', [])
        entity = r(entities) if entities else ''
        orgs = D.get('_organizations', [])
        org = r(orgs) if orgs else ''
        chals = D.get('_challenges', [])
        sols = F.get('solutions_list', ['build'])
        f['topic']=topic; f['trend_trend']=trend
        f['challenge_challenge']=r(chals) if chals else ''
        f['solution_solution']=r(sols)
        bgt = F.get('background_tpl', 'bg')
        f['background_text']=bgt.format(trend=trend, entity=entity, org=org, topic=topic)
        f['prep_work']=F.get('prep_work','')
        f['execution_detail']=F.get('execution_detail','')
        f['acceptance_criteria']=F.get('acceptance_criteria','')
        mets=[('漏洞修复率','%d%%'%ri(85,100),'%d%%'%ri(75,98)),('平均修复时间(MTTR)','<=%dh'%ri(1,24),'%dh'%ri(1,48)),
              ('投资回报率(ROI)','>=%d%%'%ri(10,50),'%d%%'%ri(5,45))]
        for i,(m,t,a) in enumerate(mets):
            f['metric%d'%(i+1)]=m; f['target%d'%(i+1)]=t; f['actual%d'%(i+1)]=a; f['rate%d'%(i+1)]=ri(75,98)
        qis = D.get('_quality_items', [])
        qat = F.get('quality_analysis_tpl', 'qa {item}')
        f['quality_analysis']=qat.format(item=r(qis) if qis else 'process')
        t1o = D.get('_tech_options1', [])
        t1t = F.get('tech1_tpl', 'tech1 {tech}')
        f['tech1_detail']=t1t.format(tech=r(t1o) if t1o else '')
        t2o = D.get('_tech_options2', [])
        t2t = F.get('tech2_tpl', 'tech2 {tech}')
        f['tech2_detail']=t2t.format(tech=r(t2o) if t2o else '')
        t3o = D.get('_tech_options3', [])
        t3t = F.get('tech3_tpl', 'tech3 {tech}')
        f['tech3_detail']=t3t.format(tech=r(t3o) if t3o else '')
        f['lesson1']=F.get('lesson1',''); f['lesson2']=F.get('lesson2',''); f['lesson3']=F.get('lesson3','')
        f['improve1']=F.get('improve1',''); f['improve2']=F.get('improve2','')
        ct = F.get('conclusion_tpl', 'done {topic}')
        f['conclusion']=ct.format(topic=topic)

    try: return tpl.format(**f)
    except KeyError as e:
        print('  [WARN] Missing key:', e)
        return tpl

def generate_articles(categories, tags, authors, count=1000):
    total, batch, idx = 0, [], 1
    for i in range(count):
        cat = categories[i % len(categories)]
        tkey, ctpl_key = CAT_MAP.get(cat.name, ('industry_titles', 'content_template_generic'))
        template = r(D[tkey])
        content_tpl = D[ctpl_key]
        title_opts = {'{}个':str(ri(1,99)),'{}项':str(ri(5,50)),'{}条':str(ri(3,30)),
                      '{}小时':str(ri(1,72)),'{}天':str(ri(1,90)),'{}%':str(ri(10,95)),
                      '{}TB':str(ri(1,500)),'{}台':str(ri(10,500)),'{}份':str(ri(1,50)),
                      '{}万':str(ri(10,5000)),'{}家':str(ri(3,100)),'{}种':str(ri(2,20)),
                      '{}章':str(ri(3,12)),'{}节':str(ri(5,30)),'{}件':str(ri(10,500))}
        title = template
        for k,v in title_opts.items(): title = title.replace(k, v)
        title = re.sub(r'\{\}', lambda m: str(ri(1,100)), title)
        while '{}' in title: title = title.replace('{}', str(ri(1,100)), 1)

        sm = r(D.get('summary_templates', ['summary']))
        am = D.get('_methods', ['method'])
        stds = D.get('_standards', ['std'])
        amd = F.get('audit_methodologies', ['audit'])
        ts = D.get('_target_systems', ['sys'])
        dt = D.get('_data_types', ['data'])
        summary = sm.format(method=r(am), num=ri(5,80), high=ri(1,15), medium=ri(3,25),
                            low=ri(5,40), standard=r(stds),
                            methodology=r(amd),
                            target_system=r(ts), system_count=ri(3,20),
                            server_count=ri(10,200), network_count=ri(5,80), data_type=r(dt))

        content = build_content(cat.name, content_tpl)
        pub_at = datetime.now() - timedelta(days=ri(0,365), hours=ri(0,23), minutes=ri(0,59))
        cover = r(D.get('cover_images', ['https://images.unsplash.com/photo-1550751827-4bd374c72f58?w=800&q=80'])[0])
        art = Article(title=title, summary=summary, content=content,
                      cover_image=cover,
                      category=cat, author=r(authors), status='published',
                      read_count=ri(50,30000), like_count=ri(5,3000),
                      comment_count=ri(0,150), is_recommended=(random.random()<0.08),
                      published_at=pub_at)
        atags = random.sample(tags, k=ri(2, min(6,len(tags))))
        batch.append((art, atags)); idx += 1
        if len(batch) >= 100:
            for art2, t in batch: art2.save(); art2.tags.set(t); total += 1
            print(f'  Written {total}/{count}'); batch = []
    if batch:
        for art2, t in batch: art2.save(); art2.tags.set(t); total += 1
        print(f'  Written {total}/{count}')
    print('[OK] Created %d articles' % total)

def main():
    print('=' * 55)
    print(' YiJianDaoDi - Module 2 Business Data Init')
    print('=' * 55)
    clear_old_data()
    cats = create_categories(); tags = create_tags(); auths = create_authors()
    generate_articles(cats, tags, auths, count=1000)
    nC = Category.objects.count(); nT = Tag.objects.count()
    nA = FrontAuthor.objects.count(); nArt = Article.objects.count()
    print('\n[DONE] Categories:%d Tags:%d Authors:%d Articles:%d' % (nC, nT, nA, nArt))
    print('=' * 55)

if __name__ == '__main__':
    main()
