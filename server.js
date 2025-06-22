require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get survey stats
app.get('/api/stats', async (req, res) => {
    try {
        const { count: totalSurveys } = await supabase
            .from('surveys')
            .select('*', { count: 'exact', head: true });

        const { data: recentSurveys } = await supabase
            .from('surveys')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        const { data: ratingData } = await supabase
            .from('surveys')
            .select('rating');

        const avgRating = ratingData?.length > 0
            ? (ratingData.reduce((sum, s) => sum + s.rating, 0) / ratingData.length).toFixed(2)
            : 0;

        res.json({
            success: true,
            totalSurveys: totalSurveys || 0,
            averageRating: parseFloat(avgRating),
            recentSurveys: recentSurveys || [],
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent surveys
app.get('/api/surveys/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        
        const { data: surveys, error } = await supabase
            .from('surveys')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({
            success: true,
            surveys: surveys || [],
            count: surveys?.length || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get daily survey counts for last 7 days
app.get('/api/surveys/daily', async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: surveys, error } = await supabase
            .from('surveys')
            .select('created_at, rating')
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Group by day
        const dailyCounts = {};
        surveys?.forEach(survey => {
            const date = survey.created_at.substring(0, 10);
            if (!dailyCounts[date]) {
                dailyCounts[date] = { count: 0, totalRating: 0 };
            }
            dailyCounts[date].count++;
            dailyCounts[date].totalRating += survey.rating;
        });

        // Calculate averages
        Object.keys(dailyCounts).forEach(date => {
            dailyCounts[date].avgRating = 
                (dailyCounts[date].totalRating / dailyCounts[date].count).toFixed(2);
        });

        res.json({
            success: true,
            dailyData: dailyCounts,
            totalCount: surveys?.length || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
});
