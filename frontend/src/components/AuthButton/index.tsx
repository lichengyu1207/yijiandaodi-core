import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';

interface AuthButtonProps extends ButtonProps {
  permission: string | string[];
  mode?: 'hidden' | 'disabled';
  noAuthTip?: string;
  children: React.ReactNode;
}

const AuthButton: React.FC<AuthButtonProps> = ({
  permission,
  mode = 'hidden',
  noAuthTip = '您没有此操作权限',
  children,
  ...buttonProps
}) => {
  const { hasPermission, hasAnyPermission } = usePermission();

  const permitted = Array.isArray(permission)
    ? hasAnyPermission(permission)
    : hasPermission(permission);

  if (!permitted && mode === 'hidden') {
    return null;
  }

  if (!permitted && mode === 'disabled') {
    return (
      <Tooltip title={noAuthTip}>
        <span>
          <Button {...buttonProps} disabled style={{ ...buttonProps.style }}>
            {children}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return <Button {...buttonProps}>{children}</Button>;
};

export default AuthButton;
