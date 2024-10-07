"use client";

import { useMediaQuery } from "@dango/shared";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import React, { useRef } from "react";

function HomePage() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });
  const { push } = useRouter();
  const isMd = useMediaQuery("md");
  const scale = useTransform(scrollYProgress, [0.7, 1], [0, 1]);
  const translateYMobile = useTransform(scrollYProgress, [0.5, 1], ["85%", "-60%"]);
  const translateYDesktop = useTransform(scrollYProgress, [0.5, 1], ["70%", "-30%"]);

  return (
    <div
      className="flex flex-1 flex-col w-full  relative items-center justify-between scrollbar-none min-h-[130vh] md:min-h-[150vh] pb-4"
      ref={targetRef}
    >
      <img
        src="/images/logo.webp"
        alt="logo"
        className="fixed mx-0 top-6 z-50 h-6 md:h-12 object-contain"
      />
      <motion.div className="header-landing pb-20 pt-[72px] md:pt-32 w-full flex flex-col gap-12 items-center h-[80vh] lg:h-[95vh] px-4">
        <picture className="object-contain md:max-w-[80%] xl:max-w-[70%] 2xl:max-w-[60%] w-full">
          <source srcSet="/images/background.webp" media="(min-width: 768px)" />
          <img src="/images/background-mobile.webp" alt="background-mobile" className="w-full" />
        </picture>
      </motion.div>
      <motion.div
        style={{ translateY: isMd ? translateYDesktop : translateYMobile }}
        className="flex flex-col gap-8 md:gap-24 items-center px-[18px]"
      >
        <motion.h1 className="text-4xl md:text-7xl font-extrabold max-w-[1030px] italic text-center">
          Bringing back the good things of the last cycle
        </motion.h1>
        <motion.button
          style={{ scale }}
          onClick={() => push("/auth/login")}
          className="text-lg md:text-8xl bg-surface-pink-200 px-8 py-3 md:px-[72px] md:py-4 rounded-[20px] md:rounded-[48px] font-extrabold text-surface-rose-200 italic w-fit"
        >
          Enter Portal
        </motion.button>
      </motion.div>
      <footer className="flex flex-col gap-10 items-center justify-center w-full">
        <div className="flex gap-12 uppercase font-extrabold">
          <a href="https://x.com/leftCurveSoft" target="_blank" rel="noreferrer">
            X
          </a>
          <a href="/">DISCORD</a>
        </div>
        <div className="flex items-center justify-between md:justify-center text-xs font-light md:gap-12 px-4 w-full">
          <a href="/">TERMS OF USE</a>
          <a href="/">COOKIE POLICY</a>
          <a href="/">PRIVACY POLICY</a>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;