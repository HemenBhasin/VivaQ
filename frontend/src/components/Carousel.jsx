import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Carousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      type: 'testimonial',
      content: {
        quote: "VivaQ has revolutionized how I create quizzes. The AI integration is incredible and saves me hours of work!",
        author: "Dr. Sarah Johnson",
        role: "Professor of Computer Science",
        avatar: "👩‍🏫"
      }
    },
    {
      type: 'feature',
      content: {
        title: "AI-Powered Quiz Generation",
        description: "Generate intelligent, context-aware quizzes in seconds using advanced AI technology",
        icon: "🤖",
        stats: "1000+ quizzes generated"
      }
    },
    {
      type: 'testimonial',
      content: {
        quote: "The real-time analytics help me understand exactly where my students need more support.",
        author: "Michael Chen",
        role: "High School Teacher",
        avatar: "👨‍🏫"
      }
    },
    {
      type: 'feature',
      content: {
        title: "Real-time Analytics",
        description: "Track student performance with detailed analytics and insights",
        icon: "📊",
        stats: "95% accuracy rate"
      }
    },
    {
      type: 'testimonial',
      content: {
        quote: "The interface is so intuitive. My students love taking quizzes on VivaQ!",
        author: "Emily Rodriguez",
        role: "Middle School Educator",
        avatar: "👩‍💼"
      }
    },
    {
      type: 'feature',
      content: {
        title: "Seamless User Experience",
        description: "Beautiful, responsive design that works perfectly on all devices",
        icon: "✨",
        stats: "99.9% uptime"
      }
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            What People <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Say</span>
          </h2>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
            Discover how VivaQ is transforming education and empowering educators worldwide
          </p>
        </motion.div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Main Carousel */}
          <div className="relative h-96 md:h-80 overflow-hidden rounded-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-full max-w-4xl mx-auto px-8">
                  {slides[currentSlide].type === 'testimonial' ? (
                    <div className="text-center">
                      <div className="text-6xl mb-6">{slides[currentSlide].content.avatar}</div>
                      <blockquote className="text-2xl md:text-3xl font-medium text-white mb-8 leading-relaxed">
                        "{slides[currentSlide].content.quote}"
                      </blockquote>
                      <div className="text-purple-200">
                        <div className="font-semibold text-lg">{slides[currentSlide].content.author}</div>
                        <div className="text-sm opacity-80">{slides[currentSlide].content.role}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-6xl mb-6">{slides[currentSlide].content.icon}</div>
                      <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        {slides[currentSlide].content.title}
                      </h3>
                      <p className="text-xl text-purple-200 mb-6 max-w-2xl mx-auto">
                        {slides[currentSlide].content.description}
                      </p>
                      <div className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-2 rounded-full text-sm font-semibold">
                        {slides[currentSlide].content.stats}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/10 backdrop-blur-lg rounded-full p-3 text-white hover:bg-white/20 transition-all duration-300 border border-white/20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/10 backdrop-blur-lg rounded-full p-3 text-white hover:bg-white/20 transition-all duration-300 border border-white/20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-8 space-x-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 scale-125'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="w-full bg-white/10 rounded-full h-1">
            <motion.div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Auto-play Indicator */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center space-x-2 text-purple-200 text-sm">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span>Auto-playing</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Carousel; 