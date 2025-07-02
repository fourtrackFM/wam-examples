import { h, JSX } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// Define types for our component props
interface KnobProps {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
}

interface SamplerViewProps {
	plugin: any; // Using 'any' for simplicity, ideally this would be a more specific type
}

interface SamplerParameters {
	gain: number;
	playbackRate: number;
	loop: boolean;
	loopStart: number;
	loopEnd: number;
	[key: string]: number | boolean; // Index signature to allow indexing with strings
}
const samplerStyles = `
  .sampler-container {
    font-family: Arial, sans-serif;
    background-color: #2c3e50;
    color: white;
    border-radius: 10px;
    padding: 20px;
    width: 300px;
    user-select: none;
  }
  
  .sampler-title {
    text-align: center;
    margin-bottom: 20px;
    font-size: 18px;
    color: #3498db;
  }
  
  .control-group {
    margin-bottom: 15px;
  }
  
  .control-label {
    display: block;
    margin-bottom: 5px;
    font-size: 14px;
    color: #ecf0f1;
  }
  
  .knob-container {
    display: flex;
    justify-content: space-between;
    margin: 10px 0;
  }
  
  .knob {
    text-align: center;
    width: 60px;
  }
  
  .knob-label {
    display: block;
    font-size: 12px;
    margin-top: 5px;
    color: #bdc3c7;
  }
  
  .knob-value {
    font-size: 10px;
    color: #95a5a6;
    margin-top: 2px;
  }
  
  .slider {
    width: 100%;
    margin: 10px 0;
  }
  
  .toggle-container {
    display: flex;
    align-items: center;
    margin: 10px 0;
  }
  
  .toggle-switch {
    margin-right: 10px;
  }
  
  .file-input {
    display: none;
  }
  
  .load-button {
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 15px;
    cursor: pointer;
    width: 100%;
    font-size: 14px;
    margin-top: 10px;
    transition: background-color 0.3s;
  }
  
  .load-button:hover {
    background-color: #2980b9;
  }
  
  .sample-info {
    font-size: 12px;
    color: #bdc3c7;
    text-align: center;
    margin-top: 15px;
    height: 30px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// Knob component for rotary controls
const Knob = ({ label, value, min, max, onChange }: KnobProps) => {
	const knobRef = useRef<SVGSVGElement>(null);
	const [dragging, setDragging] = useState(false);
	const [startY, setStartY] = useState(0);
	const [startValue, setStartValue] = useState(0);

	// Calculate the rotation angle based on the value
	const angle = ((value - min) / (max - min)) * 270 - 135;

	const handleMouseDown = (e: MouseEvent) => {
		setDragging(true);
		setStartY(e.clientY);
		setStartValue(value);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		e.preventDefault();
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (dragging) {
			// Calculate the new value based on mouse movement
			// Moving up increases the value, moving down decreases it
			const delta = startY - e.clientY;
			const range = max - min;
			const newValue = Math.min(
				max,
				Math.max(min, startValue + (delta * range) / 200)
			);
			onChange(newValue);
		}
	};

	const handleMouseUp = () => {
		setDragging(false);
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	};

	// Format the displayed value
	const displayValue = Number(value).toFixed(2);

	return (
		<div className="knob">
			<svg
				width="40"
				height="40"
				ref={knobRef}
				onMouseDown={handleMouseDown}
				style={{ cursor: 'pointer' }}
			>
				{/* Knob background */}
				<circle
					cx="20"
					cy="20"
					r="18"
					fill="#34495e"
					stroke="#7f8c8d"
					strokeWidth="1"
				/>

				{/* Knob indicator */}
				<line
					x1="20"
					y1="20"
					x2="20"
					y2="5"
					stroke="#ecf0f1"
					strokeWidth="2"
					transform={`rotate(${angle} 20 20)`}
				/>

				{/* Center dot */}
				<circle cx="20" cy="20" r="3" fill="#ecf0f1" />
			</svg>
			<span className="knob-label">{label}</span>
			<span className="knob-value">{displayValue}</span>
		</div>
	);
};

// SamplerView component
export const SamplerView = ({ plugin }: SamplerViewProps) => {
	const [parameters, setParameters] = useState<SamplerParameters>({
		gain: 1.0,
		playbackRate: 1.0,
		loop: false,
		loopStart: 0,
		loopEnd: 44100,
	});

	const [currentSample, setCurrentSample] = useState('No sample loaded');
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Initialize parameters from the plugin
		const updateParams = async () => {
			if (plugin && plugin.audioNode) {
				const node = plugin.audioNode;
				// Get the current parameters from the plugin
				const paramValues = await node.getParameterValues();

				if (paramValues) {
					const newParams = { ...parameters };

					// Update each parameter
					Object.entries(paramValues).forEach(([key, paramInfo]) => {
						if (
							paramInfo &&
							typeof paramInfo === 'object' &&
							'value' in paramInfo
						) {
							const value = (paramInfo as any).value;
							if (key === 'loop') {
								newParams[key] = value > 0.5;
							} else {
								newParams[key] = value;
							}
						}
					});

					setParameters(newParams);
				}
			}
		};

		updateParams();
	}, [plugin]);

	const updateParameter = (key: string, value: number | boolean) => {
		// Update local state
		setParameters((prev) => ({ ...prev, [key]: value }));

		// Update the plugin parameter
		if (plugin && plugin.audioNode) {
			const paramValue = key === 'loop' ? (value ? 1 : 0) : value;
			plugin.audioNode.setParameterValues({ [key]: paramValue });
		}
	};

	const handleFileSelect = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleFileChange = (
		e: JSX.TargetedEvent<HTMLInputElement, Event>
	) => {
		const files = (e.currentTarget as HTMLInputElement).files;
		if (files && files.length > 0 && plugin && plugin.audioNode) {
			const file = files[0];
			try {
				setCurrentSample(`Loading ${file.name}...`);

				// Create a URL for the file
				const fileUrl = URL.createObjectURL(file);

				// Load the sample
				plugin.audioNode
					.loadSample(fileUrl)
					.then(() => {
						setCurrentSample(file.name);
						// Revoke the URL when no longer needed
						URL.revokeObjectURL(fileUrl);
					})
					.catch((error: Error) => {
						console.error('Error loading sample:', error);
						setCurrentSample(`Error loading ${file.name}`);
						URL.revokeObjectURL(fileUrl);
					});
			} catch (error) {
				console.error('Error loading sample:', error);
				setCurrentSample(`Error loading ${file.name}`);
			}
		}
	};

	return (
		<div className="sampler-container">
			<style>{samplerStyles}</style>
			<div className="sampler-title">Sample Player</div>

			<div className="control-group">
				<button className="load-button" onClick={handleFileSelect}>
					Load Sample
				</button>
				<input
					type="file"
					ref={fileInputRef}
					className="file-input"
					accept="audio/*"
					onChange={handleFileChange}
				/>
				<div className="sample-info">{currentSample}</div>
			</div>

			<div className="control-group">
				<div className="knob-container">
					<Knob
						label="Gain"
						value={parameters.gain}
						min={0}
						max={2}
						onChange={(value) => updateParameter('gain', value)}
					/>
					<Knob
						label="Rate"
						value={parameters.playbackRate}
						min={0.25}
						max={4}
						onChange={(value) =>
							updateParameter('playbackRate', value)
						}
					/>
				</div>
			</div>

			<div className="control-group">
				<label className="control-label">
					<input
						type="checkbox"
						checked={parameters.loop}
						onChange={(
							e: JSX.TargetedEvent<HTMLInputElement, Event>
						) => {
							updateParameter(
								'loop',
								(e.currentTarget as HTMLInputElement).checked
							);
						}}
					/>
					Loop Sample
				</label>
			</div>

			{parameters.loop && (
				<div className="control-group">
					<label className="control-label">Loop Start</label>
					<input
						type="range"
						className="slider"
						min={0}
						max={parameters.loopEnd - 1000}
						value={parameters.loopStart}
						onChange={(
							e: JSX.TargetedEvent<HTMLInputElement, Event>
						) => {
							updateParameter(
								'loopStart',
								parseInt(
									(e.currentTarget as HTMLInputElement).value
								)
							);
						}}
					/>

					<label className="control-label">Loop End</label>
					<input
						type="range"
						className="slider"
						min={parameters.loopStart + 1000}
						max={44100 * 10}
						value={parameters.loopEnd}
						onChange={(
							e: JSX.TargetedEvent<HTMLInputElement, Event>
						) => {
							updateParameter(
								'loopEnd',
								parseInt(
									(e.currentTarget as HTMLInputElement).value
								)
							);
						}}
					/>
				</div>
			)}
		</div>
	);
};
