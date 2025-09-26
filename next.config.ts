import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {

    config.module.rules.push({
      test: /\.handlebars$/,
      loader: "handlebars-loader",
      options: {
        // You can add options here if needed
      },
    });
    return config;
  },
};

export default nextConfig;
