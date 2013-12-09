// With liberal contributions from the arbor.js sample project

(function($) {
    var Renderer = function(canvasId) {
        var canvas = $(canvasId).get(0);
        var particleSystem;

        var levels;
        var components;
        var dependencyKinds;

        var ctx;

        var that = {
            init:function(system) {
                particleSystem = system;
                particleSystem.screenSize(canvas.width, canvas.height);
                // We're intentionally doing this within the physics engine instead of CSS,
                // since we want it to be able to work with that information for bouncing stuff
                // off the edges appropriately
                particleSystem.screenPadding(80);

                that.initMouseHandling();
            },

            parameters:function(staticData) {
                // staticData: {
                //     components: {
                //         <component-id>: {
                //             name: <string-english-display-name>
                //         }, ...
                //     },
                //     levels: {
                //         <level-id>: {
                //             name: <string-english-display-name>,
                //             range: [<int-positioning-hint-start>, <int-positioning-hint-end>]
                //         }, ...
                //     },
                //     dependencyKinds: {
                //         <dependency_kind-id>: {
                //             name: <string-english-display-name>,
                //             style: <"solid" | "dotted">
                //         }, ...
                //     }
                // }
                components = staticData.components;
                levels = staticData.levels;
                dependencyKinds = staticData.dependencyKinds;
            },

            drawRequirementEdge:function(requirementEdge, screenSourcePoint, screenTargetPoint) {
                // requirementEdge: {source:skillNode, target:skillNode, length:#, data:<fkey-dependencyKind>}
                // screenSourcePoint: {x:#, y:#}  source position in screen coords
                // screenTargetPoint: {x:#, y:#}  target position in screen coords
                // kind: an index into that.kinds
                // skillNode: see drawSkillNode

                ctx.strokeStyle = "rgba(0,0,0, .333)";
                ctx.lineWidth = requirementEdge.data == "IS_REQUIRED" ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(screenSourcePoint.x, screenSourcePoint.y);
                ctx.lineTo(screenTargetPoint.x, screenTargetPoint.y);
                ctx.stroke();
            },

            drawSkillNode:function(skillNode, pt) {
                // skillNode: {mass:#, p:{x,y}, name:"", data:<skill>}
                // pt: {x:#, y:#}  node position in screen coords
                // skill: {
                //     id: <unique-int-or-string>
                //     name: <string-english-display-name>
                //     level: <fkey-levels>
                //     component: <fkey-component>
                //     requires: [ { skill: <fkey-skill>, kind: <fkey-dependencyKind> }, ... ]
                //     (optional) x: <int-positioning-hint>
                //     (optional) y: <int-positioning-hint>
                //     (optional) enables: [ { skill: <fkey-skill>, kind: <fkey-dependencyKind> }, ... ]
                // }
                var skill = skillNode.data;
                var nodeBoxes = {};
                // Text-in-box taken blatently from halfviz demo
                
                // determine the box size and round off the coords if we'll be
                // drawing a text label (awful alignment jitter otherwise...)
                var label = skill.name || "";
                var w = ctx.measureText(""+label).width + 10;
                if (!(""+label).match(/^[ \t]*$/)) {
                    pt.x = Math.floor(pt.x);
                    pt.y = Math.floor(pt.y);
                } else {
                    label = null;
                }

                // draw a rectangle centered at pt
                ctx.fillStyle = "rgba(0,0,0,.2)";
                ctx.fillRect(pt.x-w/2, pt.y-10, w, 20);
                nodeBoxes[skillNode.id] = [pt.x-w/2, pt.y-11, w, 22];

                // draw the text
                if (label) {
                    ctx.font = "12px Helvetica";
                    ctx.textAlign = "center";
                    ctx.fillStyle = "white";
                    ctx.fillText(label || "", pt.x, pt.y+4);
                    ctx.fillText(label || "", pt.x, pt.y+4);
                } 
            },

            redraw:function() {
                ctx = canvas.getContext("2d");

                ctx.fillStyle = "white";
                ctx.fillRect(0,0, canvas.width, canvas.height);

                // Edges are first intentionally - we want nodes to draw on top of them if necessary
                particleSystem.eachEdge(that.drawRequirementEdge);
                particleSystem.eachNode(that.drawSkillNode);
            },

            onResize:function() {
                particleSystem.screenSize(canvas.width, canvas.height);
            },

            initMouseHandling:function() {
                // no-nonsense drag and drop (thanks springy.js)
                var dragged = null;

                // set up a handler object that will initially listen for mousedowns then
                // for moves and mouseups while dragging
                var handler = {
                    clicked:function(e) {
                        var pos = $(canvas).offset();
                        _mouseP = arbor.Point(e.pageX-pos.left, e.pageY-pos.top);
                        dragged = particleSystem.nearest(_mouseP);

                        if (dragged && dragged.node !== null) {
                            // while we're dragging, don't let physics move the node
                            dragged.node.fixed = true;
                        }

                        $(canvas).bind('mousemove', handler.dragged);
                        $(window).bind('mouseup', handler.dropped);

                        return false;
                    },

                    dragged:function(e) {
                        var pos = $(canvas).offset();
                        var s = arbor.Point(e.pageX-pos.left, e.pageY-pos.top);

                        if (dragged && dragged.node !== null) {
                            var p = particleSystem.fromScreen(s);
                            dragged.node.p = p;
                        }

                        return false;
                    },

                    dropped:function(e) {
                        if (dragged===null || dragged.node===undefined) { return; }
                        if (dragged.node !== null) { dragged.node.fixed = false; }
                        dragged.node.tempMass = 1000;
                        dragged = null;
                        $(canvas).unbind('mousemove', handler.dragged);
                        $(window).unbind('mouseup', handler.dropped);
                        _mouseP = null;
                        return false;
                    }
                };

                // start listening
                $(canvas).mousedown(handler.clicked);
            },
        };
        return that;
    }    

    // It's important that no two skills share the same x,y hint initially.
    // Otherwise, Arbor basically divides by zero and then memory leaks like crazy as all the points
    // collision detect forever.
    function sanitizeSkill(skill) {
        return {
            name: skill.name,
            level: skill.level,
            component: skill.component
        };
    }

    function populate(sys, data) {
        console.log("Repopulating particle system");
        sys.renderer.parameters({
            components: data.components,
            levels: data.levels,
            dependencyKinds: data.dependency_kind            
        });

        var skillsById = {};
        data.skills.forEach(function(skill) {
            sys.addNode(skill.id, sanitizeSkill(skill));
            skillsById[skill.id] = skill;
        });

        data.skills.forEach(function(skill) {
            if (skill.enables) {
                skill.enables.forEach(function(enablement) {
                    if (!skillsById[enablement.skill]) {
                        console.log("Bad enablement from " + skill.id + " to " + enablement.skill);
                    } else {
                        var reqs = skillsById[enablement.skill].requires;
                        if (reqs[skill.id]) {
                            console.log("Duplicate enablement from " + skill.id + " to " + enablement.skill);
                        } else {
                            reqs[skill.id] = { skill: skill.id, kind: enablement.kind };
                        }
                    }
                });
            }
        });
        // For display consistency, we want to make sure all skill nodes are added before
        // any relationship edges are added.
        data.skills.forEach(function(skill) {
            if (skill.requires) {
                skill.requires.forEach(function(requirement) {
                    if (!skillsById[requirement.skill]) {
                        console.log("Bad requirement from " + skill.id + " for " + requirement.skill);
                    } else {
                        sys.addEdge(requirement.skill, skill.id, requirement.kind);
                    }
                });
            }
        });
    }

    function populateFromDataUri(sys, dataUri) {
        var dataRequest = new XMLHttpRequest();
        dataRequest.onload = function() {
            var dataText = dataRequest.responseText;
            var data = JSON.parse(dataText);
            populate(sys, data);
        };
        dataRequest.open("GET", dataUri, true);
        dataRequest.send();
    }

    var onResize;
    function resizeCanvas() {
        var canvas = $("#viewport").get(0);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        if (onResize) { onResize(); }
    }

    $(document).ready(function(){
        var sys = arbor.ParticleSystem(1000, 600, 0.5); // create the system with sensible repulsion/stiffness/friction
        sys.parameters({gravity:true}); // use center-gravity to make the graph settle nicely (ymmv)
        sys.renderer = Renderer("#viewport"); // our newly created renderer will have its .init() method called shortly by sys...

        populateFromDataUri(sys, "Stages_of_practice_map.json");
        
        onResize = sys.renderer.onResize;
        window.addEventListener('resize', resizeCanvas, false);
        resizeCanvas();
    })

})(this.jQuery);
