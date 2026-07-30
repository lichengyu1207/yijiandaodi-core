import json

with open('front_data_content.json', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Total file length: {len(content)} characters")

try:
    json.loads(content)
    print("JSON is valid!")
except json.JSONDecodeError as e:
    print(f"\n❌ JSON Error at position {e.pos} (char {e.pos}):")
    print(f"   Error message: {e.msg}")
    print(f"   Line: {e.lineno}, Column: {e.colno}")
    
    # 显示错误位置前后内容
    start = max(0, e.pos - 100)
    end = min(len(content), e.pos + 100)
    
    print(f"\n📍 Context around error (showing chars {start}-{end}):")
    print("-" * 80)
    context = content[start:end]
    print(context)
    print("-" * 80)
    
    # 用repr显示精确字符
    print(f"\n🔍 Repr (exact characters):")
    print(repr(content[max(0, e.pos-30):e.pos+30]))
