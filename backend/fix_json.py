import json
import re

# 读取文件
with open('front_data_content.json', 'r', encoding='utf-8') as f:
    content = f.read()

print("🔧 修复JSON中的单引号问题...")
print(f"原始文件长度: {len(content)} 字符")

# 修复策略：将单引号包裹的字符串转换为双引号
# 但要小心处理内部已经有的双引号

# 查找类似 '....' 的单引号字符串并替换为 "...."
def fix_single_quotes(text):
    # 匹配单引号内的内容，但不匹配双引号内的
    # 使用正则表达式查找: '...'
    result = text
    
    # 查找所有单引号字符串
    pattern = r"'([^']*(?:\"[^\"]*\"[^']*)*)'"
    
    def replace_match(match):
        inner = match.group(1)
        # 将内部的双引号转义
        escaped = inner.replace('"', '\\"')
        return f'"{escaped}"'
    
    result = re.sub(pattern, replace_match, text)
    return result

fixed_content = fix_single_quotes(content)

print(f"修复后文件长度: {len(fixed_content)} 字符")

# 验证修复后的JSON是否有效
try:
    data = json.loads(fixed_content)
    print("\n✅ JSON修复成功！语法验证通过")
    
    # 保存修复后的文件
    with open('front_data_content.json', 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    print("✅ 已保存修复后的文件")
    
    # 显示数据统计
    print(f"\n📊 数据统计:")
    print(f"   - 分类数量: {len(data.get('categories', []))}")
    print(f"   - 标签数量: {len(data.get('tags', []))}")
    if 'articles' in data:
        print(f"   - 文章数量: {len(data['articles'])}")
        
except json.JSONDecodeError as e:
    print(f"\n❌ 修复后仍有错误: {e.msg} (位置: {e.pos})")
    # 显示新错误的位置
    start = max(0, e.pos - 50)
    end = min(len(fixed_content), e.pos + 50)
    print(f"错误上下文: {repr(fixed_content[start:end])}")
