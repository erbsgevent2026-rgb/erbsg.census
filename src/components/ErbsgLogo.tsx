import React from "react";

interface ErbsgLogoProps {
  className?: string;
  size?: number | string;
}

export const ErbsgLogo: React.FC<ErbsgLogoProps> = ({
  className = "w-10 h-10",
  size,
}) => {
  return (
    <img
      src="/erbsg-official-logo.svg"
      alt="Eastern Railway Bharat Scouts and Guides"
      className={`${className} object-contain rounded-full`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
};
