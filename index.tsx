/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

interface Innovation {
    title: string;
    description: string;
    image_prompt: string;
}

interface InnovationWithImage extends Omit<Innovation, 'image_prompt'> {
    imageUrl: string;
}

const App: React.FC = () => {
    const [innovations, setInnovations] = useState<InnovationWithImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedInnovation, setSelectedInnovation] = useState<InnovationWithImage | null>(null);

    const fetchInnovations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            // 1. Generate innovation ideas
            const textResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: "Generate a list of 6 innovative futuristic technologies for the year 2050. For each, provide a concise title, a short description (2-3 sentences), and a detailed, visually rich prompt for an image generation model to create a photorealistic concept art of the technology.",
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                image_prompt: { type: Type.STRING }
                            },
                            required: ["title", "description", "image_prompt"],
                        },
                    },
                },
            });
            
            const innovationIdeas: Innovation[] = JSON.parse(textResponse.text);

            // 2. Generate images for each idea
            const innovationsWithImages = await Promise.all(
                innovationIdeas.map(async (idea) => {
                    const imageResponse = await ai.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: idea.image_prompt,
                        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
                    });

                    const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
                    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                    
                    return {
                        title: idea.title,
                        description: idea.description,
                        imageUrl: imageUrl,
                    };
                })
            );

            setInnovations(innovationsWithImages);
        } catch (err) {
            console.error("Error generating content:", err);
            setError("Failed to fetch innovations from the future. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInnovations();
    }, [fetchInnovations]);

    const handleRegenerate = () => {
        setInnovations([]);
        fetchInnovations();
    };
    
    const handleOpenModal = (innovation: InnovationWithImage) => {
        setSelectedInnovation(innovation);
    };

    const handleCloseModal = () => {
        setSelectedInnovation(null);
    };

    return (
        <div className="main-container">
            <h1>Future Innovations Showcase 2050</h1>
            <div className="controls">
                <button onClick={handleRegenerate} disabled={loading} className="regenerate-button">
                    {loading ? 'Generating...' : 'Generate New Future'}
                </button>
            </div>
            
            {loading ? (
                <div className="loader-container">
                    <div className="loader"></div>
                    <p className="loader-text">Generating the Future...</p>
                </div>
            ) : error ? (
                <p className="error-message">{error}</p>
            ) : (
                <div className="innovation-grid" aria-live="polite">
                    {innovations.map((item, index) => (
                        <InnovationCard 
                            key={index} 
                            {...item}
                            index={index}
                            onCardClick={() => handleOpenModal(item)} 
                        />
                    ))}
                </div>
            )}

            {selectedInnovation && (
                <Modal innovation={selectedInnovation} onClose={handleCloseModal} />
            )}
        </div>
    );
};

interface CardProps extends InnovationWithImage {
    index: number;
    onCardClick: () => void;
}

const InnovationCard: React.FC<CardProps> = ({ title, description, imageUrl, index, onCardClick }) => (
    <div 
        className="innovation-card"
        onClick={onCardClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onCardClick()}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${title}`}
        style={{ animationDelay: `${index * 100}ms` }}
    >
        <img src={imageUrl} alt={title} className="innovation-image" />
        <div className="innovation-content">
            <h2 className="innovation-title">{title}</h2>
            <p className="innovation-description">{description}</p>
        </div>
    </div>
);

interface ModalProps {
    innovation: InnovationWithImage;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ innovation, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose} aria-label="Close modal">&times;</button>
                <img src={innovation.imageUrl} alt={innovation.title} className="modal-image" />
                <div className="modal-text-content">
                    <h2 id="modal-title" className="innovation-title">{innovation.title}</h2>
                    <p className="innovation-description">{innovation.description}</p>
                </div>
            </div>
        </div>
    );
};


const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
