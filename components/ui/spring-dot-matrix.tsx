"use client";

import React from "react";
import { motion } from "framer-motion";

export const SpringDotMatrix = () => {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <motion.div
          key={index}
          className="h-2 w-2 rounded-full bg-zinc-800 dark:bg-white"
          animate={{ scale: [1, 0.4, 1] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: (Math.floor(index / 3) + (index % 3)) * 0.15,
          }}
        />
      ))}
    </div>
  );
};

export default SpringDotMatrix;
