import { motion } from 'framer-motion';

interface TypewriterTextProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}

const charVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
};

const lineVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};

export default function TypewriterText({
  text,
  className,
  delay = 50,
}: TypewriterTextProps) {
  const lines = text.split('\n');
  let globalIndex = 0;

  return (
    <div className={className}>
      {lines.map((line, lineIdx) => (
        <motion.div
          key={lineIdx}
          variants={lineVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {line.split('').map((char, charIdx) => (
            <motion.span
              key={`${lineIdx}-${charIdx}`}
              custom={globalIndex++}
              variants={charVariants}
              style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : undefined }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
