"""
安全提取AboutSecurity项目的文本资源
仅提取.txt、.md、.yaml等文本文件，跳过可执行文件
"""
import zipfile
import os
import shutil

def extract_safe_resources(zip_path, output_dir):
    """
    安全解压，仅提取文本文件
    
    Args:
        zip_path: zip文件路径
        output_dir: 输出目录
    """
    # 允许的文件扩展名（仅文本文件）
    safe_extensions = [
        '.txt', '.md', '.yaml', '.yml', '.json',
        '.py', '.js', '.ts', '.html', '.css',
        '.xml', '.csv', '.log', '.conf', '.cfg'
    ]
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    extracted_count = 0
    skipped_count = 0
    
    print(f"[安全解压] 开始解压: {zip_path}")
    print(f"[安全解压] 输出目录: {output_dir}")
    print(f"[安全解压] 仅提取文本文件: {', '.join(safe_extensions)}")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # 获取所有文件列表
            file_list = zip_ref.namelist()
            
            for file_info in file_list:
                # 获取文件扩展名
                _, ext = os.path.splitext(file_info)
                ext = ext.lower()
                
                # 检查是否为安全文件
                if ext in safe_extensions:
                    try:
                        # 提取文件
                        zip_ref.extract(file_info, output_dir)
                        extracted_count += 1
                        print(f"  ✅ 提取: {file_info}")
                    except Exception as e:
                        print(f"  ❌ 失败: {file_info} - {str(e)}")
                        skipped_count += 1
                else:
                    # 跳过可执行文件
                    skipped_count += 1
                    
        print(f"\n[安全解压] 完成！")
        print(f"  - 提取文件: {extracted_count} 个")
        print(f"  - 跳过文件: {skipped_count} 个（可执行文件、二进制文件等）")
        
        return True
        
    except Exception as e:
        print(f"[安全解压] 错误: {str(e)}")
        return False

if __name__ == "__main__":
    zip_path = r"C:\MsSafeData\Desktop\yijiandaodi\wanglaq\AboutSecurity-master.zip"
    output_dir = r"C:\MsSafeData\Desktop\yijiandaodi\security-knowledge-base"
    
    extract_safe_resources(zip_path, output_dir)