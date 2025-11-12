import React from "react";
import { motion } from "framer-motion";
import "../styles/LandingIntro.css";

const LandingIntro = ({ onFinish }) => {
  return (
    <motion.div
      className="landing-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      onAnimationComplete={() => {
        // Keep the intro visible for a bit, then trigger finish
        setTimeout(onFinish, 2000);
      }}
    >
      <motion.h1
        className="landing-logo"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        THRIFT<span>LY</span>
      </motion.h1>

      <motion.p
        className="landing-tagline"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
      >
        old goods, new stories.
      </motion.p>
    </motion.div>
  );
};

export default LandingIntro;
