"""
小鉴桌宠精灵图集生成器
生成符合Petdex标准的像素风格桌宠动画
"""

from PIL import Image, ImageDraw, ImageFont
import os
import math

# 配置
SPRITESHEET_WIDTH = 1536
SPRITESHEET_HEIGHT = 1872
FRAME_WIDTH = 192
FRAME_HEIGHT = 208
COLS = 8
ROWS = 9
BACKGROUND_COLOR = (255, 0, 255)  # Magenta for transparency

# 小鉴的配色方案
COLORS = {
    'primary': (46, 134, 193),      # 深蓝色 #2E86C1
    'secondary': (245, 247, 250),    # 浅灰色 #F5F7FA
    'accent_green': (88, 214, 141),  # 绿色 #58D68D
    'accent_red': (231, 76, 60),     # 红色 #E74C3C
    'white': (255, 255, 255),
    'black': (0, 0, 0),
    'dark_blue': (26, 82, 118),      # 深蓝色阴影
}

def create_base_character():
    """创建小鉴的基础形象（像素风格）"""
    # 创建一个帧大小的图像
    img = Image.new('RGBA', (FRAME_WIDTH, FRAME_HEIGHT), (255, 0, 255, 0))
    draw = ImageDraw.Draw(img)
    
    # 中心点
    cx, cy = FRAME_WIDTH // 2, FRAME_HEIGHT // 2
    
    # 绘制身体（圆形）
    body_radius = 50
    body_y = cy + 20
    draw.ellipse([
        cx - body_radius, body_y - body_radius,
        cx + body_radius, body_y + body_radius
    ], fill=COLORS['primary'], outline=COLORS['dark_blue'])
    
    # 绘制头部（圆形）
    head_radius = 45
    head_y = cy - 30
    draw.ellipse([
        cx - head_radius, head_y - head_radius,
        cx + head_radius, head_y + head_radius
    ], fill=COLORS['primary'], outline=COLORS['dark_blue'])
    
    # 绘制侦探帽
    hat_width = 60
    hat_height = 20
    hat_y = head_y - head_radius - 10
    draw.rectangle([
        cx - hat_width // 2, hat_y,
        cx + hat_width // 2, hat_y + hat_height
    ], fill=COLORS['dark_blue'], outline=COLORS['black'])
    
    # 帽檐
    brim_width = 70
    draw.rectangle([
        cx - brim_width // 2, hat_y + hat_height - 5,
        cx + brim_width // 2, hat_y + hat_height
    ], fill=COLORS['dark_blue'], outline=COLORS['black'])
    
    # 绘制眼睛（像素风格的点）
    eye_radius = 6
    eye_offset = 20
    eye_y = head_y
    
    # 左眼
    draw.ellipse([
        cx - eye_offset - eye_radius, eye_y - eye_radius,
        cx - eye_offset + eye_radius, eye_y + eye_radius
    ], fill=COLORS['white'])
    draw.ellipse([
        cx - eye_offset - 3, eye_y - 3,
        cx - eye_offset + 3, eye_y + 3
    ], fill=COLORS['black'])
    
    # 右眼
    draw.ellipse([
        cx + eye_offset - eye_radius, eye_y - eye_radius,
        cx + eye_offset + eye_radius, eye_y + eye_radius
    ], fill=COLORS['white'])
    draw.ellipse([
        cx + eye_offset - 3, eye_y - 3,
        cx + eye_offset + 3, eye_y + 3
    ], fill=COLORS['black'])
    
    # 绘制微笑
    smile_width = 20
    smile_y = head_y + 20
    draw.arc([
        cx - smile_width, smile_y - 5,
        cx + smile_width, smile_y + 15
    ], start=0, end=180, fill=COLORS['white'], width=3)
    
    # 绘制放大镜（在身体前方）
    glass_x = cx + 40
    glass_y = body_y
    glass_radius = 15
    
    # 放大镜镜片
    draw.ellipse([
        glass_x - glass_radius, glass_y - glass_radius,
        glass_x + glass_radius, glass_y + glass_radius
    ], fill=COLORS['secondary'], outline=COLORS['dark_blue'], width=2)
    
    # 放大镜手柄
    handle_length = 30
    draw.line([
        glass_x + glass_radius, glass_y,
        glass_x + glass_radius + handle_length, glass_y + 15
    ], fill=COLORS['dark_blue'], width=4)
    
    return img

def animate_idle(base_img, frame_num):
    """idle状态动画：轻轻呼吸"""
    img = base_img.copy()
    # 呼吸效果：上下移动
    offset = int(math.sin(frame_num * math.pi / 4) * 3)
    
    # 创建新图像并应用偏移
    new_img = Image.new('RGBA', (FRAME_WIDTH, FRAME_HEIGHT), (255, 0, 255, 0))
    new_img.paste(img, (0, offset))
    
    return new_img

def animate_thinking(base_img, frame_num):
    """thinking状态动画：举着放大镜观察"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img)
    
    # 放大镜上下移动
    offset = int(math.sin(frame_num * math.pi / 4) * 5)
    
    # 添加思考符号
    if frame_num % 4 == 0:
        draw.text((120, 30), "?", fill=COLORS['accent_green'], font=None)
    
    return img

def animate_alert(base_img, frame_num):
    """alert状态动画：紧张表情"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img)
    
    # 添加警示符号
    draw.text((90, 20), "!", fill=COLORS['accent_red'], font=None)
    
    # 眼睛睁大效果
    cx = FRAME_WIDTH // 2
    head_y = FRAME_HEIGHT // 2 - 30
    
    # 重绘更大的眼睛
    eye_radius = 8
    eye_offset = 20
    
    # 左眼
    draw.ellipse([
        cx - eye_offset - eye_radius, head_y - eye_radius,
        cx - eye_offset + eye_radius, head_y + eye_radius
    ], fill=COLORS['white'])
    draw.ellipse([
        cx - eye_offset - 4, head_y - 4,
        cx - eye_offset + 4, head_y + 4
    ], fill=COLORS['black'])
    
    # 右眼
    draw.ellipse([
        cx + eye_offset - eye_radius, head_y - eye_radius,
        cx + eye_offset + eye_radius, head_y + eye_radius
    ], fill=COLORS['white'])
    draw.ellipse([
        cx + eye_offset - 4, head_y - 4,
        cx + eye_offset + 4, head_y + 4
    ], fill=COLORS['black'])
    
    return img

def animate_success(base_img, frame_num):
    """success状态动画：开心微笑"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img)
    
    # 添加星星效果
    if frame_num % 2 == 0:
        draw.text((50, 50), "*", fill=COLORS['accent_green'], font=None)
        draw.text((130, 40), "*", fill=COLORS['accent_green'], font=None)
    
    return img

def animate_sleep(base_img, frame_num):
    """sleep状态动画：蜷缩睡觉"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img)
    
    # 添加睡眠符号
    draw.text((100, 30), "z", fill=COLORS['secondary'], font=None)
    if frame_num > 2:
        draw.text((120, 20), "z", fill=COLORS['secondary'], font=None)
    if frame_num > 4:
        draw.text((140, 10), "z", fill=COLORS['secondary'], font=None)
    
    return img

def animate_wave(base_img, frame_num):
    """wave状态动画：挥动放大镜"""
    img = base_img.copy()
    # 放大镜左右摇摆
    return img

def animate_drag(base_img, frame_num):
    """drag状态动画：拖动时专注"""
    img = base_img.copy()
    return img

def animate_click(base_img, frame_num):
    """click状态动画：点击时惊喜"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img)
    
    # 添加惊喜符号
    if frame_num % 2 == 0:
        draw.text((80, 30), "!", fill=COLORS['accent_green'], font=None)
    
    return img

def generate_spritesheet():
    """生成完整的精灵图集"""
    print("开始生成小鉴桌宠精灵图集...")
    
    # 创建精灵图集
    spritesheet = Image.new('RGBA', (SPRITESHEET_WIDTH, SPRITESHEET_HEIGHT), BACKGROUND_COLOR)
    
    # 创建基础形象
    base_character = create_base_character()
    
    # 动画函数列表
    animations = [
        animate_idle,      # Row 0
        animate_thinking,  # Row 1
        animate_alert,     # Row 2
        animate_success,   # Row 3
        animate_sleep,     # Row 4
        animate_wave,      # Row 5
        animate_drag,      # Row 6
        animate_click,     # Row 7
    ]
    
    # 生成每一行每一列的帧
    for row, animate_func in enumerate(animations):
        print(f"生成第 {row} 行动画...")
        for col in range(COLS):
            # 生成动画帧
            frame = animate_func(base_character, col)
            
            # 计算位置
            x = col * FRAME_WIDTH
            y = row * FRAME_HEIGHT
            
            # 粘贴到精灵图集
            spritesheet.paste(frame, (x, y))
    
    # 保存精灵图集
    output_path = os.path.expanduser("~/.petdex/pets/xiaojian/spritesheet.webp")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 保存为WebP格式（带透明度）
    spritesheet.save(output_path, 'WEBP', lossless=True)
    
    print(f"✅ 精灵图集已生成: {output_path}")
    print(f"   尺寸: {SPRITESHEET_WIDTH}x{SPRITESHEET_HEIGHT}")
    print(f"   帧数: {COLS * len(animations)}")
    
    # 同时保存一个PNG版本用于预览
    preview_path = output_path.replace('.webp', '.png')
    spritesheet.save(preview_path, 'PNG')
    print(f"✅ 预览图已生成: {preview_path}")
    
    return output_path

if __name__ == "__main__":
    try:
        # 检查依赖
        from PIL import Image
        print("✅ 依赖已安装")
        
        # 生成精灵图集
        output_path = generate_spritesheet()
        
        print("\n🎉 小鉴桌宠精灵图集生成完成！")
        print(f"📁 文件位置: {output_path}")
        print("\n下一步：")
        print("1. 查看生成的精灵图")
        print("2. 使用AI工具优化细节")
        print("3. 在Petdex Desktop中测试")
        print("4. 运行: npx petdex run xiaojian")
        
    except ImportError:
        print("❌ 缺少依赖库")
        print("请安装Pillow库:")
        print("  pip install Pillow")