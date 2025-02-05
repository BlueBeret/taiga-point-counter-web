"use client";
import { useEffect, useState } from "react";
import { useCheckUser } from "../../../hooks/authHooks";
import toast from "react-hot-toast";


export default function Dashboard() {
    const user = useCheckUser()
    const [currentPoint, setCurrentPoint] = useState(0)
    const [totalPoint, setTotalPoint] = useState(0)
    const [currentRank, setCurrentRank] = useState(0)
    const [contributions, setContributions] = useState([])
    const [isCalculating, setIsCalculating] = useState(false)

    const calculatePoint = async (projects, month) => {
        // month is year-mm
        if (projects.length == 0) {
            toast.error("Please select at least one project")
            return false
        }
        if (!month) {
            toast.error("Please select a month")
            return 0
        }

        setIsCalculating(true)

        let loadingToast = toast.loading("Calculating your cuteness")

        let milestones_byproject = []
        let done_point = 0
        let total_point = 0

        let project_promises = []
        const total_project = projects.length
        let done_project = 0
        for (let project of projects) {
            let milestonethismonth = []
            let host = new URL(user.photo)
            host = host.origin
            try {

                let data = await fetch(host + `/api/v1/milestones?project=${project.id}`, {
                    headers: {
                        Authorization: `Bearer ${user.auth_token}`
                    }
                })
                data = await data.json()
                // check if milestone is this month
                milestonethismonth = data.filter(milestone => {
                    return milestone.estimated_finish.includes(month)
                })
            } catch (err) {
                toast.error("Something went wrong",
                    {
                        id: loadingToast
                    })
            }
            let userStoryByMilestone = []

            let milestone_promises = []
            const total_milestone = milestonethismonth.length
            let done_milestone = 0
            for (let milestone of milestonethismonth) {
                let userStories = [];
                let fetchPromises = [];
                for (let userStory of milestone.user_stories) {
                    let fetchPromise = fetch(host + `/api/v1/userstories/${userStory.id}`, {
                        headers: {
                            Authorization: `Bearer ${user.auth_token}`
                        }
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.assigned_users.includes(user.id)) {
                                let desc = data.description;
                                // find string =point
                                let start_tag = desc.indexOf("=point");
                                let end_tag = desc.indexOf("=point", start_tag + 1);
                                let point = 0;
                                if (start_tag != -1 && end_tag != -1) {
                                    // split by newline
                                    let lines = desc.substring(start_tag + 6, end_tag).split("\n");
                                    // throw away empty lines
                                    lines = lines.filter(line => line.length > 5);
                                    // split by space
                                    lines = lines.map(line => line.split(/\s+/));

                                    let tmp_total = 0;
                                    for (let line of lines) {
                                        // find number
                                        let number = line.find(word => !isNaN(word));
                                        let isMyPoint = line.find(word => word == "@" + user.username);
                                        if (number) {
                                            tmp_total += parseFloat(number);
                                        }
                                        if (isMyPoint) {
                                            console.log("found my point", number);
                                            point = parseFloat(number);
                                        }
                                    }
                                    if (tmp_total != data.total_points) {
                                        toast.error(`Total point is not equal to the sum of points in description, ${tmp_total} != ${data.total_points}`);
                                    }
                                }

                                if (point == 0) {
                                    point = data.total_points / data.assigned_users.length;
                                }
                                total_point += point;
                                if (data.status_extra_info.name == "Done") {
                                    done_point += point;
                                }
                                userStories.push({
                                    id: data.id,
                                    mypoint: point,
                                    name: data.subject,
                                    status: data.status_extra_info.name,
                                });
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching user story:', error);
                        }).finally(
                            () => {
                                let percentage = 0 + (done_project / total_project) * 100 + (done_milestone / total_milestone / total_project) * 100 // (done_fetch / total_fetch / total_milestone / total_project) * 100
                                percentage = percentage.toFixed(1)
                                toast.loading(`You're made of  ${percentage}% cute material.`, {
                                    id: loadingToast
                                })
                            }
                        );

                    fetchPromises.push(fetchPromise);
                }

                // Wait for all fetch requests to complete
                const milestone_promise = Promise.all(fetchPromises).then(() => {
                    done_milestone += 1
                    userStoryByMilestone.push({
                        name: milestone.name,
                        userstories: userStories
                    })
                })
                milestone_promises.push(milestone_promise)
            }
            const project_promise = Promise.all(milestone_promises).then(() => {
                done_project += 1
                milestones_byproject.push({
                    name: project.name,
                    milestones: userStoryByMilestone
                })
            })

            project_promises.push(project_promise)

        }
        await Promise.all(project_promises)
        setContributions(milestones_byproject)
        setCurrentPoint(done_point.toFixed(2))
        setTotalPoint(total_point.toFixed(2))
        toast.success("Dammn, you're so cute <3", {
            id: loadingToast
        })
        setIsCalculating(false)
    }

    useEffect(() => {
        if (user?.auth_token && currentRank == 0) {
            // fetch leaderboard
            let hostname = new URL(user.photo)
            hostname = hostname.origin
            fetch("/api/leaderboard?hostname=" + hostname, {
                headers: {
                    Authorization: `Bearer ${user.auth_token}`
                }
            }).then(resp => resp.json().then(leaderboard => {
                // find user index and set current point
                let userIndex = leaderboard.users.findIndex(obj => obj.id == user.id)
                if (userIndex == -1) {
                    return
                }
                setCurrentPoint(leaderboard.users[userIndex].point.toFixed(2))
                setCurrentRank(userIndex + 1)
            }))
        }
    }, [user])

    return <main className="flex flex-col p-8 gap-4">
        <div className="flex flex-wrap justify-center w-full p-8 floor border border-pink-0 bg-purple-50 items-center gap-4">
            <img className="rounded-full" src={user?.photo} width={64} height={64} ></img>
            <div className="flex flex-col w-24  sm:w-auto">
                <span className="text-[18px]">{user?.username}</span>
                <span className="text-[12px]">{user?.bio}</span>
            </div>
            <div className="flex sm:ml-auto">
                <div className="flex flex-col px-4">
                    <span className="text-[12px]">Point</span>
                    <span className="text-[32px] leading-[48px]">{currentPoint}</span>
                </div>
                <div className="w-[2px] mx-4 bg-[#666666]">
                    {/* this is separator */}
                </div>
                <div className="flex flex-col px-4">
                    <span className="text-[12px]">Rank</span>
                    <span className="text-[32px] leading-[48px]">#{currentRank}</span>
                </div>
            </div>
        </div>
        <UserInput user={user} calculatePoint={
            async (project, month) => {
                const start_time = performance.now()
                await calculatePoint(project, month)
                const end_time = performance.now()
                console.log("Time taken: ", end_time - start_time)
            }
        } isCalculating={isCalculating} />
        <ContributionsSummary contributions={contributions} total_point={totalPoint} />
    </main>
}

const ContributionsSummary = ({ contributions, setCurrentPoint, currentPoint, total_point }) => {
    const DoneBadge = () => <span className="bg-green-100 border border-green-0 rounded-md px-2 py-1">Done</span>
    const OnGoingBadge = () => <span className=" min-w-min bg-yellow-100 border border-yellow-0 rounded-md px-2 py-1">On Going</span>
    return <div className="w-full overflow-x-auto flex flex-col border border-pink-50">
        <table className="min-w-[500px]">
            <thead className="floor border border-pink-50">
                <tr>
                    <th className="py-2 px-2 lg:py-4 lg:px-8 text-left">Project</th>
                    <th className="py-2 px-2 lg:py-4 lg:px-8 text-left">Milestone</th>
                    <th className="py-2 px-2 lg:py-4 lg:px-8 text-left">User Story</th>
                    <th className="py-2 px-2 lg:py-4 lg:px-8 text-left">Status</th>
                    <th className="py-2 px-2 lg:py-4 lg:px-8 text-left">Point</th>
                </tr>
            </thead>
            <tbody>
                {contributions?.map(project => {
                    let dummy = <></>
                    let first_project = true
                    for (let milestone of project.milestones) {
                        let first_milestone = true
                        for (let user_stories of milestone.userstories) {
                            let current = <tr key={user_stories.id} className="border-b-[1px] border-purple-0">
                                <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">{first_project ? project.name : ""}</td>
                                <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">{first_milestone ? milestone.name : ""}</td>
                                <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">{user_stories.name}</td>
                                <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">{user_stories.status == "Done" ? <DoneBadge /> : <OnGoingBadge />}</td>
                                <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">{user_stories.mypoint}</td>
                            </tr>
                            first_project = false
                            first_milestone = false

                            dummy = <>{dummy}{current}</>
                        }
                    }
                    return dummy
                })}
                {contributions?.length == 0 ? <tr className="floor border-b-[1px] border-purple-0"> <td className="py-2 px-2 lg:py-4 lg:px-8 text-left" colSpan={5}>No contributions yet</td></tr> :
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td className="py-2 px-2 lg:py-4 lg:px-8 text-left">Expected point</td>
                        <td className="py-2 px-2 lg:py-4 lg:px-8 text-left font-bold text-lg">{total_point}</td>
                    </tr>
                }
            </tbody>
        </table>
    </div>
}

const UserInput = ({ user, calculatePoint, isCalculating }) => {
    const [availableProjects, setAvailableProjects] = useState([
        {
            name: "Project 1",
            id: 1
        },
        {
            name: "Project 2",
            id: 2
        },
        {
            name: "Project 3",
            id: 3
        }
    ])
    const [isSelectingProject, setIsSelectingProject] = useState(false)
    // get projects from localstorage if available
    const projectsFromLocalStorage = JSON.parse(localStorage.getItem("projects")) || []
    const [projects, setProjects] = useState(projectsFromLocalStorage)

    const currentMonth = new Date().toISOString().split("T")[0].slice(0, 7)
    const [month, setMonth] = useState(currentMonth)

    useEffect(() => {
        const target = document.querySelector('#project-select')
        const target2 = document.querySelector('#project-select-button')

        document.addEventListener('click', (event) => {
            const withinBoundaries = event.composedPath().includes(target) || event.composedPath().includes(target2)

            if (withinBoundaries) {
            } else {
                setIsSelectingProject(false)
            }
        })
    }, [])

    useEffect(() => {
        localStorage.setItem("projects", JSON.stringify(projects))
    }, [projects])

    // get project list
    useEffect(() => {
        if (!user?.auth_token) return
        let host = new URL(user?.photo)
        host = host.origin
        fetch(host + "/api/v1/projects", {
            headers: {
                "Authorization": `Bearer ${user.auth_token}`
            },
        }).then(resp => resp.json().then(data => {
            data = data.filter(project => project.i_am_member)
            data = data.sort((a, b) => {
                let date_a = Date.parse(a.created_date)
                let date_b = Date.parse(b.created_date)
                return date_b - date_a
            })
            setAvailableProjects(data)
        }))
    }, [user])

    return <div className="flex gap-4 w-full flex-wrap">
        <span className="mr-auto py-2 px-4 hidden lg:block">Point calculator</span>

        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="select month" className="bg-purple-50 w-full lg:w-[344px]  py-2 px-4"></input>
        <div className="flex gap-4">
            <div id="project-select-button" value={`${projects.length} ${projects.length > 1 ? "projects" : "project"} selected`} placeholder="select month" onClick={(e) => setIsSelectingProject(!isSelectingProject)}
                className="bg-purple-50 w-full lg:w-[344px] py-2 px-4 cursor-pointer">
                {`${projects.length} ${projects.length > 1 ? "projects" : "project"} selected`}
            </div>

            {/* dropdown to select project */}
            <div id="project-select" className={`${isSelectingProject ? "absolute" : "hidden"} w-[344px] bg-purple-50`}>
                {availableProjects.map(project => {
                    let isSelected = projects.find(p => p.id == project.id)

                    return <div key={project.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-50 py-2 px-4 rounded-md" onClick={(e) => {
                        // remove if already selected
                        if (isSelected) {
                            setProjects(projects.filter(p => p.id != project.id))
                        } else {
                            setProjects([...projects, project])
                        }
                    }}> <span className="border border-white w-4 h-4 flex justify-center items-center">
                            <div className={`${isSelected ? "w-2 h-2 rounded-[1px] bg-white" : ""}`}>
                            </div>
                        </span>
                        <span>{project.name}</span>
                    </div>
                })}
            </div>

            <button className="bg-pink-0 text-purple-100 py-2 px-4 rounded-md" disabled={isCalculating} onClick={(e) => calculatePoint(projects, month)}>Calculate</button>
        </div>
    </div>
}