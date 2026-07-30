# Playwright配置文件
# 用于桌面端自动化测试

name: Desktop E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd desktop-client-2.0
        npm install
    
    - name: Build application
      run: |
        cd desktop-client-2.0
        npm run build
    
    - name: Install Playwright
      run: |
        npm install -D @playwright/test playwright
    
    - name: Run tests
      run: |
        npx playwright test tests/desktop.spec.js --headed
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: test-results/