const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({

    title: {

        type: String,

        required: [true, "Title is required"],

        trim: true

    },

    description: {

        type: String,

        default: ""

    },

    completed: {

        type: Boolean,

        default: false

    },

    createdAt: {

        type: Date,

        default: Date.now

    },

    priority: {

        type: String,

        enum: ["low", "medium", "high"],

        default: "medium"

    }

});


// Pre-save Hook
taskSchema.pre("save", function(next){

    if (typeof this.title === "string") {

        this.title = this.title.trim();

    }

    next();

});

taskSchema.pre(["findOneAndUpdate", "findByIdAndUpdate"], function(next){

    const update = this.getUpdate();

    if (update && typeof update.title === "string") {

        update.title = update.title.trim();

        this.setUpdate(update);

    }

    next();

});


module.exports = mongoose.model("Task", taskSchema);