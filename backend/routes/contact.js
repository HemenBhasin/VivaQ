const express = require('express');
const { Resend } = require('resend');
const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/contact - Handle contact form submissions
router.post('/contact', express.json(), async (req, res) => {
  try {
    const { name, email, message, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please enter a valid email address' 
      });
    }

    // Log the contact form submission
    console.log('Contact Form Submission:', {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString()
    });

    // Email content
    const emailData = {
      from: 'VivaQ Contact Form <onboarding@resend.dev>',
      to: ['hemenbhasin@gmail.com'],
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5cf6;">New Contact Form Submission</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Contact Details:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #8b5cf6;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Submitted on: ${new Date(timestamp).toLocaleString()}
            </p>
          </div>
          <div style="text-align: center; color: #666; font-size: 12px;">
            <p>This email was sent from the VivaQ contact form.</p>
          </div>
        </div>
      `
    };

    // Send email using Resend
    const info = await resend.emails.send(emailData);
    console.log('Email sent successfully:', info.id);

    // Send success response
    res.status(200).json({ 
      message: 'Message sent successfully! We\'ll get back to you soon.',
      success: true 
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    // Check if it's a Resend API key error
    if (error.message && error.message.includes('API key')) {
      return res.status(500).json({ 
        message: 'Email service not configured. Please check Resend API key settings.',
        success: false,
        error: 'API key not configured'
      });
    }
    
    // Check if it's a rate limit error
    if (error.statusCode === 429) {
      return res.status(500).json({ 
        message: 'Email service rate limit exceeded. Please try again later.',
        success: false,
        error: 'Rate limit exceeded'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to send message. Please try again later.',
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 