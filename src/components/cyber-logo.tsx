"use client";

const logoText = `
    ..-.........-..    
   .-'    .-.    '-.   
  /     .' '.     \\  
 /     /  _  \\     \\ 
|      \\ (_) /      |
|       '. .'       |
 \\        '        / 
  \\      / \\      /  
   '-.  /   \\  .-'   
      '-------'      
`;

const CyberLogo = () => {
    return (
      <div className="relative font-mono text-center text-primary text-shadow-glow">
        <pre className="relative glitch" data-text={logoText}>
          {logoText}
        </pre>
        <div className="mt-2 text-2xl font-bold tracking-widest glitch" data-text="C Y B E R">
          C Y B E R
        </div>
      </div>
    );
  };
  
  export default CyberLogo;
  