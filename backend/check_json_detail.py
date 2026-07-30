import json
import sys

# 设置UTF-8输出
sys.stdout.reconfigure(encoding='utf-8')

with open('front_data_content.json', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"📊 文件总长度: {len(content)} 字符")
print(f"✅ 文件编码: UTF-8")

try:
    data = json.loads(content)
    print("✅ JSON格式正确!")
    print(f"   包含 {len(data.get('categories', []))} 个分类")
    print(f"   包含 {len(data.get('tags', []))} 个标签")
    if 'articles' in data:
        print(f"   包含 {len(data['articles'])} 篇文章")
except json.JSONDecodeError as e:
    print(f"❌ JSON语法错误!")
    print(f"   📍 错误位置: 第{e.lineno}行, 第{e.colno}列 (字符位置 {e.pos})")
    print(f"   🔍 错误类型: {e.msg}")
    
    # 显示错误前后内容
    error_pos = e.pos
    start = max(0, error_pos - 150)
    end = min(len(content), error_pos + 150)
    
    print(f"\n{'='*80}")
    print(f"错误位置上下文 (字符 {start}-{end}):")
    print(f"{'='*80}")
    
    context = content[start:end]
    
    # 标记错误位置
    marker_line = ' ' * (error_pos - start) + '↑ 错误在这里'
    
    print("\n原始文本:")
    print(context)
    print(marker_line)
    
    print(f"\n精确表示 (repr):")
    print(repr(content[max(0, error_pos-50):error_pos+50]))
    
    # 检查是否是常见的JSON问题
    char_at_error = content[error_pos] if error_pos < len(content) else '<EOF>'
    print(f"\n错误位置的字符: '{char_at_error}' (Unicode: U+{ord(char_at_error):04X})")
    
    # 检查前后是否有未转义的控制字符等
    if error_pos > 0:
        prev_char = content[error_pos-1]
        print(f"前一个字符: '{prev_char}' (Unicode: U+{ord(prev_char):04X})")
