import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Line } from '@react-three/drei';
import * as math from 'mathjs';

function AxisLabels({ showValues, is2D, useDegrees }) {
  if (!showValues) return null;
  
  const positions = [-4, -2, 0, 2, 4];
  
  const formatValue = (val) => {
    if (!useDegrees) return val.toString();
    return `${(val * 180 / Math.PI).toFixed(0)}°`;
  };
  
  return (
    <group>
      {/* X axis labels */}
      {positions.map(pos => (
        <Text
          key={`x-${pos}`}
          position={[pos, -0.3, 0]}
          fontSize={0.3}
          color="#ff6b6b"
        >
          {pos}
        </Text>
      ))}
      
      {/* Y axis labels (for 2D) or Z labels (for 3D) */}
      {is2D ? (
        positions.map(pos => (
          <Text
            key={`y-${pos}`}
            position={[-0.5, pos, 0]}
            fontSize={0.3}
            color="#51cf66"
          >
            {pos}
          </Text>
        ))
      ) : (
        <>
          {/* Y axis labels for 3D (green, on the depth axis) */}
          {positions.map(pos => (
            <Text
              key={`y-${pos}`}
              position={[0, -0.3, pos]}
              fontSize={0.3}
              color="#51cf66"
            >
              {pos}
            </Text>
          ))}
          {/* Z axis labels for 3D */}
          {positions.map(pos => (
            <Text
              key={`z-${pos}`}
              position={[-0.5, pos, 0]}
              fontSize={0.3}
              color="#4dabf7"
            >
              {pos}
            </Text>
          ))}
        </>
      )}
    </group>
  );
}

function Axes({ showAxes, is2D }) {
  if (!showAxes) return null;
  
  return (
    <group>
      {/* X axis - Red */}
      <Line points={[[-10, 0, 0], [10, 0, 0]]} color="#ff6b6b" lineWidth={3} />
      <Text position={[10.5, 0, 0]} fontSize={0.5} color="#ff6b6b">X</Text>
      
      {is2D ? (
        <>
          {/* Y axis for 2D - Green (height only, no depth) */}
          <Line points={[[0, -10, 0], [0, 10, 0]]} color="#51cf66" lineWidth={3} />
          <Text position={[0, 10.5, 0]} fontSize={0.5} color="#51cf66">Y</Text>
        </>
      ) : (
        <>
          {/* Y axis - Green (depth) */}
          <Line points={[[0, 0, -10], [0, 0, 10]]} color="#51cf66" lineWidth={3} />
          <Text position={[0, 0, 10.5]} fontSize={0.5} color="#51cf66">Y</Text>
          
          {/* Z axis - Blue (height) */}
          <Line points={[[0, -10, 0], [0, 10, 0]]} color="#4dabf7" lineWidth={3} />
          <Text position={[0, 10.5, 0]} fontSize={0.5} color="#4dabf7">Z</Text>
        </>
      )}
    </group>
  );
}

function findIntersections(equations, timeValue, is2D) {
  const intersections = [];
  const tolerance = 0.15;
  
  if (equations.length < 2) return intersections;
  
  try {
    for (let i = 0; i < equations.length; i++) {
      for (let j = i + 1; j < equations.length; j++) {
        const eq1 = math.compile(equations[i].equation);
        const eq2 = math.compile(equations[j].equation);
        
        if (is2D) {
          for (let x = -5; x <= 5; x += 0.2) {
            const scope = { x, t: timeValue };
            const y1 = eq1.evaluate(scope);
            const y2 = eq2.evaluate(scope);
            
            if (Math.abs(y1 - y2) < tolerance) {
              intersections.push({
                x: x,
                y: y1,
                z: null,
                t: timeValue,
                equations: [i, j]
              });
            }
          }
        } else {
          for (let x = -5; x <= 5; x += 0.5) {
            for (let y = -5; y <= 5; y += 0.5) {
              const scope = { x, y, t: timeValue };
              const z1 = eq1.evaluate(scope);
              const z2 = eq2.evaluate(scope);
              
              if (Math.abs(z1 - z2) < tolerance) {
                intersections.push({
                  x: x,
                  y: y,
                  z: z1,
                  t: timeValue,
                  equations: [i, j]
                });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error finding intersections:', e);
  }
  
  return intersections.slice(0, 20); // Limit to 20 intersections
}

function IntersectionPoints({ intersections, is2D }) {
  return (
    <group>
      {intersections.map((point, idx) => (
        <mesh 
          key={idx} 
          position={is2D ? [point.x, point.y, 0] : [point.x, point.z, point.y]}
        >
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial 
            color="#ff0066" 
            emissive="#ff0066"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function GraphSurface({ equations, timeValue, colorDimension, is2D, resolution }) {
  const allPoints = useMemo(() => {
    const res = is2D ? Math.min(resolution * 2, 200) : resolution;
    const range = 5;
    
    return equations.map((eq, eqIndex) => {
      const pts = [];
      
      try {
        const parsedEquation = math.compile(eq.equation);
        
        if (is2D) {
          for (let i = 0; i < res; i++) {
            const x = (i / res) * range * 2 - range;
            const scope = { x, t: timeValue };
            const y = parsedEquation.evaluate(scope);
            if (isFinite(y)) {
              pts.push({ x, y, z: 0, color: eq.color });
            }
          }
        } else {
          for (let i = 0; i < res; i++) {
            for (let j = 0; j < res; j++) {
              const x = (i / res) * range * 2 - range;
              const y = (j / res) * range * 2 - range;
              
              const scope = { x, y, t: timeValue };
              let z = parsedEquation.evaluate(scope);
              
              if (!isFinite(z)) continue;
              
              let color = eq.color;
              if (colorDimension) {
                const colorScope = { ...scope, z };
                const colorValue = math.compile(colorDimension).evaluate(colorScope);
                const hue = ((colorValue % 2) + 2) % 2;
                color = `hsl(${hue * 180}, 70%, 60%)`;
              }
              
              pts.push({ x, y, z, color });
            }
          }
        }
      } catch (e) {
        console.error('Equation error:', e);
      }
      
      return { points: pts, color: eq.color, is2D };
    });
  }, [equations, timeValue, colorDimension, is2D, resolution]);
  
  return (
    <group>
      {allPoints.map((graphData, idx) => {
        if (graphData.is2D) {
          return (
            <Line 
              key={idx}
              points={graphData.points.map(pt => [pt.x, pt.y, 0])} 
              color={graphData.color} 
              lineWidth={3}
            />
          );
        }
        
        return (
          <group key={idx}>
            {graphData.points.map((pt, ptIdx) => (
              <mesh key={ptIdx} position={[pt.x, pt.z, pt.y]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial 
                  color={pt.color} 
                  metalness={0.3}
                  roughness={0.4}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export default function MathVisualizer() {
  const colors = ['#4dabf7', '#ff6b6b', '#51cf66', '#ffd43b', '#ff66d9', '#66d9ff'];
  
  const [equations, setEquations] = useState([
    { equation: 'sin(x) + cos(y)', color: colors[0] },
    { equation: '', color: colors[1] }
  ]);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [timeValue, setTimeValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [colorDimension, setColorDimension] = useState('');
  const [dimension, setDimension] = useState('3D');
  const [showValues, setShowValues] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [is2D, setIs2D] = useState(false);
  const [useDegrees, setUseDegrees] = useState(false);
  const [showIntersections, setShowIntersections] = useState(false);
  const [resolution, setResolution] = useState(50);
  
  const animationRef = useRef();
  
  const intersections = useMemo(() => {
    if (!showIntersections) return [];
    return findIntersections(equations, timeValue, is2D);
  }, [equations, timeValue, is2D, showIntersections]);
  
  const startAnimation = () => {
    setIsAnimating(true);
    const animate = () => {
      setTimeValue(t => (t + 0.05) % (Math.PI * 4));
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };
  
  const stopAnimation = () => {
    setIsAnimating(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
  
  const handleDimensionChange = (dim) => {
    setDimension(dim);
    setIs2D(dim === '2D');
    
    if (dim === '2D') {
      setTimeEnabled(false);
      setColorDimension('');
      setEquations([
        { equation: 'sin(x)', color: colors[0] },
        { equation: '', color: colors[1] }
      ]);
      stopAnimation();
    } else if (dim === '3D') {
      setTimeEnabled(false);
      setColorDimension('');
      setEquations([
        { equation: 'sin(x) + cos(y)', color: colors[0] },
        { equation: '', color: colors[1] }
      ]);
      stopAnimation();
    } else if (dim === '4D') {
      setTimeEnabled(true);
      setColorDimension('');
      setEquations([
        { equation: 'sin(x + t) + cos(y + t)', color: colors[0] },
        { equation: '', color: colors[1] }
      ]);
    } else if (dim === '5D') {
      setTimeEnabled(true);
      setColorDimension('x + y');
      setEquations([
        { equation: 'sin(x + t) + cos(y + t)', color: colors[0] },
        { equation: '', color: colors[1] }
      ]);
    }
  };
  
  const updateEquation = (index, value) => {
    const newEquations = [...equations];
    newEquations[index].equation = value;
    setEquations(newEquations);
    
    // Add new empty box if last equation has content and we're under the limit
    const filledEquations = newEquations.filter(eq => eq.equation.trim() !== '');
    if (filledEquations.length === newEquations.length && newEquations.length < 6) {
      setEquations([...newEquations, { equation: '', color: colors[newEquations.length % colors.length] }]);
    }
  };
  
  const removeEquation = (index) => {
    const newEquations = equations.filter((_, i) => i !== index);
    // Ensure at least 2 boxes exist (one filled, one empty minimum)
    const filledEquations = newEquations.filter(eq => eq.equation.trim() !== '');
    if (newEquations.length < 2) {
      newEquations.push({ equation: '', color: colors[newEquations.length % colors.length] });
    }
    setEquations(newEquations);
  };
  
  return (
    <div className="w-full h-screen flex" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Main Graph Area - Left Side */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: is2D ? [0, 0, 10] : [8, 8, 8], fov: 60 }}>
          <color attach="background" args={['#1a1a2e']} />
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1.2} />
          <pointLight position={[-10, -10, -10]} intensity={0.6} />
          <pointLight position={[0, 10, 0]} intensity={0.4} color="#4dabf7" />
          
          <GraphSurface 
            equations={equations.filter(eq => eq.equation.trim() !== '')}
            timeValue={timeValue}
            colorDimension={colorDimension}
            is2D={is2D}
            resolution={resolution}
          />
          
          {showIntersections && (
            <IntersectionPoints intersections={intersections} is2D={is2D} />
          )}
          
          <Axes showAxes={showAxes} is2D={is2D} />
          <AxisLabels showValues={showValues} is2D={is2D} useDegrees={useDegrees} />
          
          <Grid 
            args={[20, 20]} 
            cellColor="#2a2a4e"
            sectionColor="#3a3a6e"
            fadeDistance={30}
            rotation={is2D ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
          />
          
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={50}
          />
        </Canvas>
      </div>
      
      {/* Right Sidebar - Controls */}
      <div className="w-96 bg-gray-900 bg-opacity-95 backdrop-blur-sm border-l border-gray-700 p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Math Visualizer</h1>
        
        {/* Dimension Selector */}
        <div className="space-y-2 mb-4">
          <label className="text-white font-semibold block">Dimension:</label>
          <div className="grid grid-cols-2 gap-2">
            {['2D', '3D', '4D', '5D'].map(dim => (
              <button
                key={dim}
                onClick={() => handleDimensionChange(dim)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  dimension === dim 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {dim}
              </button>
            ))}
          </div>
        </div>
        
        {/* Equations */}
        <div className="space-y-3 mb-4">
          <label className="text-white font-semibold block">
            Equations {is2D ? '(y =)' : '(z =)'}:
          </label>
          {equations.map((eq, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: eq.color }}
              ></div>
              <input
                type="text"
                value={eq.equation}
                onChange={(e) => updateEquation(idx, e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none font-mono text-sm"
                placeholder={is2D ? "sin(x)" : "sin(x) + cos(y)"}
              />
              {equations.length > 2 && eq.equation.trim() !== '' && (
                <button
                  onClick={() => removeEquation(idx)}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* Color Dimension for 5D */}
        {dimension === '5D' && (
          <div className="space-y-2 mb-4">
            <label className="text-white font-semibold block">Color (5th dim) =</label>
            <input
              type="text"
              value={colorDimension}
              onChange={(e) => setColorDimension(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none font-mono text-sm"
              placeholder="x + y"
            />
          </div>
        )}
        
        {/* Time Controls */}
        {timeEnabled && (
          <div className="space-y-3 mb-4 bg-gray-800 p-4 rounded-lg">
            <label className="text-white font-semibold block">
              Time (t): {timeValue.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max={Math.PI * 4}
              step="0.1"
              value={timeValue}
              onChange={(e) => setTimeValue(parseFloat(e.target.value))}
              className="w-full"
              disabled={isAnimating}
            />
            <button
              onClick={isAnimating ? stopAnimation : startAnimation}
              className={`w-full px-4 py-2 rounded-lg font-semibold ${
                isAnimating 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isAnimating ? '⏸ Stop Animation' : '▶ Animate'}
            </button>
          </div>
        )}
        
        {/* Display Options */}
        <div className="space-y-3 mb-4">
          <h3 className="text-white font-semibold">Display Options</h3>
          
          <div className="space-y-2">
            <label className="text-white font-medium block">
              Resolution: {resolution}x{resolution}{!is2D && `x${resolution}`}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={resolution}
              onChange={(e) => setResolution(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Low (Fast)</span>
              <span>High (Detailed)</span>
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={showAxes}
              onChange={(e) => setShowAxes(e.target.checked)}
              className="w-4 h-4"
            />
            Show Axes
          </label>
          
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={showValues}
              onChange={(e) => setShowValues(e.target.checked)}
              className="w-4 h-4"
            />
            Show Axis Values
          </label>
          
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={showIntersections}
              onChange={(e) => setShowIntersections(e.target.checked)}
              className="w-4 h-4"
            />
            Show Intersections
          </label>
          
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={useDegrees}
              onChange={(e) => setUseDegrees(e.target.checked)}
              className="w-4 h-4"
            />
            Use Degrees (instead of Radians)
          </label>
        </div>
        
        {/* Intersections Display */}
        {showIntersections && intersections.length > 0 && (
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            <h3 className="text-white font-semibold mb-2">
              Intersections ({intersections.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto text-sm">
              {intersections.map((point, idx) => (
                <div key={idx} className="text-gray-300 font-mono bg-gray-700 p-2 rounded">
                  {is2D ? (
                    <>x: {point.x.toFixed(2)}, y: {point.y.toFixed(2)}</>
                  ) : (
                    <>x: {point.x.toFixed(2)}, y: {point.y.toFixed(2)}, z: {point.z.toFixed(2)}</>
                  )}
                  {timeEnabled && <>, t: {point.t.toFixed(2)}</>}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Help Text */}
        <div className="text-gray-400 text-xs space-y-1 bg-gray-800 p-3 rounded-lg">
          <div className="font-bold text-white mb-1">Controls:</div>
          <div>🖱️ Left drag: Rotate</div>
          <div>🖱️ Right drag: Pan</div>
          <div>🖱️ Scroll: Zoom</div>
        </div>
      </div>
    </div>
  );
}